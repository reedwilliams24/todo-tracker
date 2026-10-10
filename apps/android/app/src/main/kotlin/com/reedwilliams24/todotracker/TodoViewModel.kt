package com.reedwilliams24.todotracker

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.reedwilliams24.todotracker.core.TodoAction
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.TodoState
import com.reedwilliams24.todotracker.core.UNDO_TIMEOUT_MS
import com.reedwilliams24.todotracker.core.addTodos
import com.reedwilliams24.todotracker.core.reduceTodos
import com.reedwilliams24.todotracker.data.TodoDatabase
import com.reedwilliams24.todotracker.data.TodoRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class TodoUiState(val state: TodoState = TodoState(), val hydrated: Boolean = false)

/** Android counterpart of `useTodos`: drives the shared reducer and persists after hydration. */
class TodoViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = TodoRepository(TodoDatabase.get(application).todos())
    private val saveLock = Mutex()
    private var undoTimer: Job? = null

    private val _ui = MutableStateFlow(TodoUiState())
    val ui: StateFlow<TodoUiState> = _ui.asStateFlow()

    init {
        viewModelScope.launch {
            val stored = repository.load()
            _ui.update { TodoUiState(reduceTodos(it.state, TodoAction.Load(stored)), hydrated = true) }
        }
    }

    fun add(draft: TodoDraft) = dispatch(TodoAction.Prepend(addTodos(emptyList(), listOf(draft)).created))
    fun toggle(id: String) = dispatch(TodoAction.Toggle(id))
    fun rename(id: String, title: String) = dispatch(TodoAction.Rename(id, title))
    fun remove(id: String) = dispatch(TodoAction.Remove(listOf(id)))
    fun clearCompleted() = dispatch(TodoAction.ClearCompleted)
    fun undo() = dispatch(TodoAction.Undo)

    private fun dispatch(action: TodoAction) {
        val before = _ui.value
        if (!before.hydrated) return
        val next = reduceTodos(before.state, action)
        _ui.value = before.copy(state = next)
        if (next.todos !== before.state.todos) persist(next)
        if (next.undoable !== before.state.undoable) scheduleUndoExpiry(next)
    }

    private fun persist(state: TodoState) {
        viewModelScope.launch {
            saveLock.withLock {
                // Save the latest list, not the one captured at launch, so writes never go backwards.
                repository.save(_ui.value.state.todos)
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
