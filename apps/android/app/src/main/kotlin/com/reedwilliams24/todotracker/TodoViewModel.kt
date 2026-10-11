package com.reedwilliams24.todotracker

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.viewModelScope
import com.reedwilliams24.todotracker.auth.AuthViewModel
import com.reedwilliams24.todotracker.auth.TodoScope
import com.reedwilliams24.todotracker.core.ConnectionState
import com.reedwilliams24.todotracker.core.CursorStore
import com.reedwilliams24.todotracker.core.RealtimeConnection
import com.reedwilliams24.todotracker.core.RealtimeTarget
import com.reedwilliams24.todotracker.core.RealtimeTransport
import com.reedwilliams24.todotracker.core.SORT_STORAGE_KEY
import com.reedwilliams24.todotracker.core.SyncEngine
import com.reedwilliams24.todotracker.core.SyncServer
import com.reedwilliams24.todotracker.core.THEME_STORAGE_KEY
import com.reedwilliams24.todotracker.core.ThemePreference
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoAction
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.TodoListHost
import com.reedwilliams24.todotracker.core.TodoRow
import com.reedwilliams24.todotracker.core.TodoSort
import com.reedwilliams24.todotracker.core.TodoState
import com.reedwilliams24.todotracker.core.UNDO_TIMEOUT_MS
import com.reedwilliams24.todotracker.core.addTodos
import com.reedwilliams24.todotracker.core.parseStoredSort
import com.reedwilliams24.todotracker.core.parseThemePreference
import com.reedwilliams24.todotracker.core.reduceTodos
import com.reedwilliams24.todotracker.data.TodoDatabase
import com.reedwilliams24.todotracker.data.TodoRepository
import com.reedwilliams24.todotracker.reminders.ReminderScheduler
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class TodoUiState(
    val state: TodoState = TodoState(),
    val hydrated: Boolean = false,
    val sort: TodoSort = TodoSort.PRIORITY,
    /** The last signed-in edit couldn't be pushed and was rolled back. */
    val pushFailed: Boolean = false,
    /** The live connection while the account list syncs over [SyncSetup.realtime]; null for the guest list. */
    val connection: ConnectionState? = null,
    /** The device has a network (ConnectivityManager's default network). */
    val online: Boolean = true,
)

/** Signed in: the server and user the account list syncs with, and the socket live updates arrive on. */
data class SyncSetup(val server: SyncServer, val userId: String, val realtime: RealtimeTransport? = null)

private const val PUSH_FAILED_MS = 5_000L

/** Android counterpart of `useTodos`: drives the shared reducer and persists after hydration. */
class TodoViewModel(application: Application) : AndroidViewModel(application) {
    private var scope = TodoScope.GUEST
    private var repository = TodoRepository(TodoDatabase.get(application).todos())
    private val reminders = ReminderScheduler(application)
    private val prefs = application.getSharedPreferences("todo-tracker", Context.MODE_PRIVATE)
    private val saveLock = Mutex()
    private var undoTimer: Job? = null

    private val _ui = MutableStateFlow(TodoUiState(sort = parseStoredSort(prefs.getString(SORT_STORAGE_KEY, null))))
    val ui: StateFlow<TodoUiState> = _ui.asStateFlow()

    // Read synchronously so the first frame already uses the stored theme.
    private val _theme = MutableStateFlow(parseThemePreference(prefs.getString(THEME_STORAGE_KEY, null)))
    val theme: StateFlow<ThemePreference> = _theme.asStateFlow()

    fun setTheme(preference: ThemePreference) {
        _theme.value = preference
        prefs.edit().putString(THEME_STORAGE_KEY, preference.key).apply()
    }

    private var loadJob: Job? = null
    private var setup: SyncSetup? = null
    private var sync: SyncEngine? = null
    private var pushFailedTimer: Job? = null
    private var connection: RealtimeConnection? = null
    private var connectionJob: Job? = null

    private val cursorStore =
        object : CursorStore {
            override fun load(): Long = prefs.getLong(AuthViewModel.SYNC_CURSOR_KEY, 0L)

            override fun save(cursor: Long) {
                prefs.edit().putLong(AuthViewModel.SYNC_CURSOR_KEY, cursor).apply()
            }
        }

    private val listHost =
        object : TodoListHost {
            override val current: List<Todo>
                get() = _ui.value.state.todos

            override fun replace(todos: List<Todo>) {
                val next = reduceTodos(_ui.value.state, TodoAction.Load(todos))
                _ui.update { it.copy(state = next) }
                persist(next)
                syncReminders()
            }
        }

    private val connectivity = application.getSystemService(ConnectivityManager::class.java)

    // Getting the network back reconnects now instead of waiting for the backoff (spec/features/realtime.md).
    private val network =
        object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                viewModelScope.launch { setOnline(true) }
            }

            override fun onLost(network: Network) {
                viewModelScope.launch { setOnline(false) }
            }
        }

    // Live while in the foreground, closed in the background (spec/features/realtime.md).
    private val foreground =
        object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) = resume()

            override fun onStop(owner: LifecycleOwner) {
                connection?.disconnect()
            }
        }

    init {
        load()
        ProcessLifecycleOwner.get().lifecycle.addObserver(foreground)
        _ui.update { it.copy(online = connectivity.activeNetwork != null) }
        connectivity.registerDefaultNetworkCallback(network)
    }

    private fun setOnline(online: Boolean) {
        val regained = online && !_ui.value.online
        _ui.update { it.copy(online = online) }
        if (regained) resume()
    }

    override fun onCleared() {
        ProcessLifecycleOwner.get().lifecycle.removeObserver(foreground)
        connectivity.unregisterNetworkCallback(network)
        connection?.disconnect()
        sync?.close()
    }

    /** Switches between the guest list and the signed-in account's local cache; [next] syncs with [sync]. */
    fun useScope(next: TodoScope, sync: SyncSetup? = null) {
        if (next == scope && loadJob != null) {
            if (sync != setup) startSync(sync)
            return
        }
        scope = next
        val name = if (next == TodoScope.ACCOUNT) TodoDatabase.ACCOUNT else TodoDatabase.GUEST
        repository = TodoRepository(TodoDatabase.get(getApplication(), name).todos())
        startSync(null)
        load(sync)
    }

    /** Pulls the account list's changes since the cursor; no-op while signed out. */
    fun pull() {
        val engine = sync ?: return
        if (!_ui.value.hydrated) return
        viewModelScope.launch {
            try {
                engine.pull()
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {}
        }
    }

    private fun startSync(next: SyncSetup?) {
        connection?.disconnect()
        sync?.close()
        setup = next
        sync = next?.let { SyncEngine(it.server, it.userId, cursorStore, listHost, ::showPushFailed) }
        watchConnection(next?.realtime)
        resume()
    }

    /** Foreground: reconnects (which pulls) when the list is live, else just pulls. */
    private fun resume() {
        val live = connection
        val engine = sync
        if (live == null || engine == null) return pull()
        if (!_ui.value.hydrated) return
        if (!ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) return
        live.connect(
            object : RealtimeTarget {
                override val userId = setup!!.userId

                override suspend fun pull() = engine.pull()

                override fun applyRemote(rows: List<TodoRow>) = engine.applyRemote(rows)
            }
        )
    }

    private fun watchConnection(transport: RealtimeTransport?) {
        connectionJob?.cancel()
        connection = transport?.let { RealtimeConnection(it, viewModelScope) }
        val live = connection ?: return _ui.update { it.copy(connection = null) }
        connectionJob =
            viewModelScope.launch { live.state.collect { state -> _ui.update { it.copy(connection = state) } } }
    }

    private fun showPushFailed() {
        _ui.update { it.copy(pushFailed = true) }
        pushFailedTimer?.cancel()
        pushFailedTimer =
            viewModelScope.launch {
                delay(PUSH_FAILED_MS)
                _ui.update { it.copy(pushFailed = false) }
            }
    }

    private fun load(sync: SyncSetup? = null) {
        loadJob?.cancel()
        _ui.update { it.copy(hydrated = false) }
        loadJob =
            viewModelScope.launch {
                val stored = saveLock.withLock { repository.load() }
                _ui.update { it.copy(state = reduceTodos(TodoState(), TodoAction.Load(stored)), hydrated = true) }
                syncReminders()
                if (sync != null) startSync(sync)
            }
    }

    /** Re-plans notifications, e.g. after the user grants notification permission. */
    fun syncReminders() {
        if (_ui.value.hydrated) reminders.sync(_ui.value.state.todos)
    }

    fun add(draft: TodoDraft) = dispatch(TodoAction.Prepend(addTodos(emptyList(), listOf(draft)).created))

    fun toggle(id: String) = dispatch(TodoAction.Toggle(id))

    fun rename(id: String, title: String) = dispatch(TodoAction.Rename(id, title))

    fun toggleMany(ids: List<String>) = dispatch(TodoAction.ToggleMany(ids))

    fun remove(id: String) = dispatch(TodoAction.Remove(listOf(id)))

    fun removeMany(ids: List<String>) = dispatch(TodoAction.Remove(ids))

    fun clearCompleted() = dispatch(TodoAction.ClearCompleted)

    fun undo() = dispatch(TodoAction.Undo)

    fun addSubtask(id: String, title: String) = dispatch(TodoAction.AddSubtask(id, title))

    fun toggleSubtask(id: String, subtaskId: String) = dispatch(TodoAction.ToggleSubtask(id, subtaskId))

    fun removeSubtask(id: String, subtaskId: String) = dispatch(TodoAction.RemoveSubtask(id, subtaskId))

    /** Drops `id` onto `targetId` within the shown rows and switches to manual sort so the new order shows. */
    fun reorder(visibleIds: List<String>, id: String, targetId: String) {
        dispatch(TodoAction.Reorder(visibleIds, id, targetId))
        setSort(TodoSort.MANUAL)
    }

    fun setSort(sort: TodoSort) {
        _ui.update { it.copy(sort = sort) }
        prefs.edit().putString(SORT_STORAGE_KEY, sort.key).apply()
    }

    private fun dispatch(action: TodoAction) {
        val before = _ui.value
        if (!before.hydrated) return
        val next = reduceTodos(before.state, action)
        _ui.value = before.copy(state = next)
        if (next.todos !== before.state.todos) {
            persist(next)
            syncReminders()
            sync?.let { engine -> viewModelScope.launch { engine.edit(before.state.todos, next.todos) } }
        }
        if (next.undoable !== before.state.undoable) scheduleUndoExpiry(next)
    }

    private fun persist(state: TodoState) {
        viewModelScope.launch {
            val target = repository
            saveLock.withLock {
                // Save the latest list, not the one captured at launch, so writes never go backwards.
                if (target === repository) repository.save(_ui.value.state.todos)
            }
        }
    }

    private fun scheduleUndoExpiry(state: TodoState) {
        undoTimer?.cancel()
        val entry = state.undoable ?: return
        undoTimer =
            viewModelScope.launch {
                delay(entry.at + UNDO_TIMEOUT_MS - System.currentTimeMillis())
                val current = _ui.value
                _ui.value = current.copy(state = reduceTodos(current.state, TodoAction.ExpireUndo))
            }
    }
}
