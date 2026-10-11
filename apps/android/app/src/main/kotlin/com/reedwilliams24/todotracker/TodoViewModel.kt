package com.reedwilliams24.todotracker

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.reedwilliams24.todotracker.core.TodoAction
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.TodoState
import com.reedwilliams24.todotracker.core.UNDO_TIMEOUT_MS
import com.reedwilliams24.todotracker.core.addTodos
import com.reedwilliams24.todotracker.core.cloudConfig
import com.reedwilliams24.todotracker.core.reduceTodos
import com.reedwilliams24.todotracker.data.AccountSession
import com.reedwilliams24.todotracker.data.AuthUser
import com.reedwilliams24.todotracker.data.OfflineCloudStore
import com.reedwilliams24.todotracker.data.SupabaseClient
import com.reedwilliams24.todotracker.data.TodoChangeFeed
import com.reedwilliams24.todotracker.data.TodoDatabase
import com.reedwilliams24.todotracker.data.TodoRepository
import com.reedwilliams24.todotracker.data.TodoStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.net.URLDecoder

data class TodoUiState(val state: TodoState = TodoState(), val hydrated: Boolean = false)

/** `enabled` is false for local-only builds; `pendingEmail` is set once a sign-in code was emailed. */
data class AuthUiState(
    val enabled: Boolean = false,
    val user: AuthUser? = null,
    val pendingEmail: String? = null,
    val busy: Boolean = false,
    val status: String? = null,
    /** Changes made on this device that haven't reached the account yet. */
    val unsynced: Int = 0,
)

/** Android counterpart of `useTodos` + `useAuth`: drives the shared reducer and persists to the active store. */
class TodoViewModel(application: Application) : AndroidViewModel(application) {
    private val local = TodoRepository(TodoDatabase.get(application).todos())
    private val account = cloudConfig(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
        ?.let { AccountSession(SupabaseClient(it), application) }
    private var store: TodoStore = local
    private val saveLock = Mutex()
    private var loadJob: Job? = null
    private var undoTimer: Job? = null
    private var feed: TodoChangeFeed? = null
    private var syncJob: Job? = null
    private var syncRequests: Channel<Unit>? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val connectivity = application.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _ui = MutableStateFlow(TodoUiState())
    val ui: StateFlow<TodoUiState> = _ui.asStateFlow()

    private val _auth = MutableStateFlow(AuthUiState(enabled = account != null, user = account?.session?.user))
    val auth: StateFlow<AuthUiState> = _auth.asStateFlow()

    init {
        useStoreFor(_auth.value.user)
    }

    fun add(draft: TodoDraft) = dispatch(TodoAction.Prepend(addTodos(emptyList(), listOf(draft)).created))
    fun toggle(id: String) = dispatch(TodoAction.Toggle(id))
    fun rename(id: String, title: String) = dispatch(TodoAction.Rename(id, title))
    fun remove(id: String) = dispatch(TodoAction.Remove(listOf(id)))
    fun clearCompleted() = dispatch(TodoAction.ClearCompleted)
    fun undo() = dispatch(TodoAction.Undo)

    fun sendCode(email: String) = authTask {
        it.client.sendCode(email)
        _auth.update { state -> state.copy(pendingEmail = email, status = "We emailed a 6-digit code to $email.") }
    }

    fun verifyCode(code: String) = authTask {
        val email = _auth.value.pendingEmail ?: return@authTask
        signedIn(it, it.client.verifyCode(email, code))
    }

    fun changeEmail() = _auth.update { it.copy(pendingEmail = null, status = null) }

    fun providerUrl(provider: String): String? = account?.client?.authorizeUrl(provider)

    /** OAuth redirect `todotracker://auth#access_token=…`. */
    fun handleRedirect(uri: Uri) = authTask {
        val params = (uri.fragment ?: uri.query).orEmpty().split("&").mapNotNull { pair ->
            val parts = pair.split("=", limit = 2)
            if (parts.size == 2) URLDecoder.decode(parts[0], "UTF-8") to URLDecoder.decode(parts[1], "UTF-8") else null
        }.toMap()
        signedIn(it, it.client.sessionFromRedirect(params))
    }

    fun signOut() = authTask {
        it.signOut()
        _auth.update { state -> state.copy(user = null, pendingEmail = null, status = null) }
        useStoreFor(null)
    }

    private fun signedIn(account: AccountSession, session: com.reedwilliams24.todotracker.data.AuthSession) {
        account.store(session)
        _auth.update { it.copy(user = session.user, pendingEmail = null, status = null) }
        useStoreFor(session.user)
    }

    private fun authTask(block: suspend (AccountSession) -> Unit) {
        val account = account ?: return
        if (_auth.value.busy) return
        _auth.update { it.copy(busy = true, status = null) }
        viewModelScope.launch {
            try {
                block(account)
            } catch (error: Exception) {
                _auth.update { it.copy(status = error.message ?: "Something went wrong.") }
            } finally {
                _auth.update { it.copy(busy = false) }
            }
        }
    }

    /** Signed in: the account's offline-first cache, synced in the background. Signed out: Room. */
    private fun useStoreFor(user: AuthUser?) {
        val account = account
        val next = if (user != null && account != null) {
            OfflineCloudStore(account, user.id, local, getApplication())
        } else {
            local
        }
        store = next
        stopSync()
        loadJob?.cancel()
        undoTimer?.cancel()
        _ui.value = TodoUiState()
        _auth.update { it.copy(unsynced = 0) }
        loadJob = viewModelScope.launch {
            val stored = try {
                next.load()
            } catch (error: Exception) {
                _auth.update { it.copy(status = "Couldn't load your todos: ${error.message}") }
                emptyList()
            }
            if (store !== next) return@launch
            _ui.value = TodoUiState(reduceTodos(TodoState(), TodoAction.Load(stored)), hydrated = true)
            _auth.update { it.copy(unsynced = next.pending()) }
            if (user != null && account != null) startSync(next, account, user.id)
        }
    }

    /**
     * Signed in: syncs after every save, on changes made on other devices (Supabase Realtime) and when the
     * network comes back. Requests during a sync collapse into one more sync; a failed sync leaves the changes
     * queued in the cache for the next request.
     */
    private fun startSync(target: TodoStore, account: AccountSession, userId: String) {
        val requests = Channel<Unit>(Channel.CONFLATED)
        syncRequests = requests
        feed = TodoChangeFeed(account, userId, viewModelScope) { requests.trySend(Unit) }
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                requests.trySend(Unit)
            }
        }.also { connectivity.registerDefaultNetworkCallback(it) }
        requests.trySend(Unit)
        syncJob = viewModelScope.launch {
            for (request in requests) {
                saveLock.withLock {
                    if (store !== target) return@withLock
                    try {
                        target.sync({ _ui.value.state.todos }) { plan ->
                            if (plan.changed) _ui.update { it.copy(state = reduceTodos(it.state, TodoAction.Load(plan.todos))) }
                        }
                    } catch (_: Exception) {
                        // Offline or token trouble: the changes stay queued until the next request.
                    }
                    _auth.update { it.copy(unsynced = target.pending()) }
                }
            }
        }
    }

    private fun stopSync() {
        feed?.close()
        feed = null
        networkCallback?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
        networkCallback = null
        syncRequests = null
        syncJob?.cancel()
    }

    override fun onCleared() {
        stopSync()
    }

    private fun dispatch(action: TodoAction) {
        val before = _ui.value
        if (!before.hydrated) return
        val next = reduceTodos(before.state, action)
        _ui.value = before.copy(state = next)
        if (next.todos !== before.state.todos) persist()
        if (next.undoable !== before.state.undoable) scheduleUndoExpiry(next)
    }

    private fun persist() {
        val target = store
        viewModelScope.launch {
            saveLock.withLock {
                if (store !== target) return@withLock
                // Save the latest list, not the one captured at dispatch, so writes never go backwards.
                try {
                    target.save(_ui.value.state.todos)
                } catch (error: Exception) {
                    _auth.update { it.copy(status = "Couldn't save: ${error.message}") }
                }
                _auth.update { it.copy(unsynced = target.pending()) }
                syncRequests?.trySend(Unit)
            }
        }
    }

    private fun scheduleUndoExpiry(state: TodoState) {
        undoTimer?.cancel()
        val entry = state.undoable ?: return
        undoTimer = viewModelScope.launch {
            delay(entry.at + UNDO_TIMEOUT_MS - System.currentTimeMillis())
            val current = _ui.value
            _ui.value = current.copy(state = reduceTodos(current.state, TodoAction.ExpireUndo))
        }
    }
}
