package com.reedwilliams24.todotracker.auth

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.reedwilliams24.todotracker.core.AuthError
import com.reedwilliams24.todotracker.core.AuthEvent
import com.reedwilliams24.todotracker.core.AuthState
import com.reedwilliams24.todotracker.core.AuthStatus
import com.reedwilliams24.todotracker.core.INITIAL_AUTH_STATE
import com.reedwilliams24.todotracker.core.SyncServer
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.guestToRows
import com.reedwilliams24.todotracker.core.isValidCode
import com.reedwilliams24.todotracker.core.isValidEmail
import com.reedwilliams24.todotracker.core.normalizeCode
import com.reedwilliams24.todotracker.core.reduceAuth
import com.reedwilliams24.todotracker.core.resendSecondsLeft
import com.reedwilliams24.todotracker.data.TodoDatabase
import com.reedwilliams24.todotracker.data.TodoRepository
import java.time.Instant
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which local list the todo screen shows. */
enum class TodoScope {
    GUEST,
    ACCOUNT,
}

/** Move on the first-sign-in prompt. Throws if the todos couldn't be moved. */
fun interface GuestTodoMover {
    suspend fun move(guest: List<Todo>, session: AuthSession)
}

/** Drives the shared auth reducer; owns the guest/account lists' lifecycle (move, discard, wipe on sign out). */
class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val client = AuthClient.create(application)
    private val guest = TodoRepository(TodoDatabase.get(application, TodoDatabase.GUEST).todos())
    private val account = TodoRepository(TodoDatabase.get(application, TodoDatabase.ACCOUNT).todos())

    /** The todos backend; null in a guest-only build. */
    val syncServer: SyncServer? = client?.sync
    private val prefs = application.getSharedPreferences("todo-tracker", Context.MODE_PRIVATE)
    private var verifying = false

    val configured = client != null

    /** Pushes the guest todos as new account rows (`guestToRows` + `push_todos`); the account list pulls them in. */
    var mover = GuestTodoMover { todos, session ->
        val rows = guestToRows(todos, session.userId, Instant.now())
        if (rows.isNotEmpty()) syncServer?.push(rows)
    }

    private val _moveFailed = MutableStateFlow(false)

    /** The last Move failed; the prompt stays up with an error. */
    val moveFailed: StateFlow<Boolean> = _moveFailed.asStateFlow()

    private val _state = MutableStateFlow(INITIAL_AUTH_STATE)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _session = MutableStateFlow<AuthSession?>(null)

    /** The signed-in user's id and access token, or null while signed out. */
    val session: StateFlow<AuthSession?> = _session.asStateFlow()

    // Read synchronously so a restored account opens straight on its cached list.
    private val _scope = MutableStateFlow(if (prefs.contains(OWNER_KEY)) TodoScope.ACCOUNT else TodoScope.GUEST)
    val scope: StateFlow<TodoScope> = _scope.asStateFlow()

    private val _resendSeconds = MutableStateFlow(0)
    val resendSeconds: StateFlow<Int> = _resendSeconds.asStateFlow()

    init {
        client?.let { auth ->
            viewModelScope.launch {
                auth.changes.collect { change ->
                    val signedIn = change.session
                    when {
                        signedIn != null -> {
                            _session.value = signedIn
                            if (!verifying && _state.value.status != AuthStatus.SIGNED_IN) {
                                claim(signedIn)
                                dispatch(AuthEvent.SignedIn(signedIn.userId, signedIn.email, guestCount = 0))
                                _scope.value = TodoScope.ACCOUNT
                            }
                        }
                        _state.value.status == AuthStatus.SIGNED_IN || change.initiated -> {
                            _session.value = null
                            dispatch(AuthEvent.SignedOut(change.initiated))
                        }
                    }
                }
            }
        }
        if (!configured) _scope.value = TodoScope.GUEST
    }

    fun open() = dispatch(AuthEvent.Open)

    fun cancel() = dispatch(AuthEvent.Cancel)

    fun changeEmail() = dispatch(AuthEvent.ChangeEmail)

    fun sendCode(email: String) {
        val auth = client ?: return
        val before = _state.value
        dispatch(AuthEvent.SendCode(email))
        if (!isValidEmail(email) || before.busy) return
        viewModelScope.launch {
            runCatching { auth.sendCode(_state.value.email) }
                .onSuccess {
                    dispatch(AuthEvent.CodeSent(System.currentTimeMillis()))
                    tickResend()
                }
                .onFailure { dispatch(AuthEvent.Failed(it.kind())) }
        }
    }

    fun resend() = sendCode(_state.value.email)

    fun verify(input: String) {
        val auth = client ?: return
        val code = normalizeCode(input)
        val before = _state.value
        dispatch(AuthEvent.Verify(code))
        if (!isValidCode(code) || before.busy) return
        verifying = true
        viewModelScope.launch {
            runCatching { auth.verifyCode(before.email, code) }
                .onSuccess { signedIn ->
                    val guestTodos = guest.load()
                    claim(signedIn)
                    _session.value = signedIn
                    dispatch(AuthEvent.SignedIn(signedIn.userId, signedIn.email, guestTodos.size))
                    if (guestTodos.isEmpty()) _scope.value = TodoScope.ACCOUNT
                }
                .onFailure { dispatch(AuthEvent.Failed(it.kind())) }
            verifying = false
        }
    }

    /** Resolves the first-sign-in prompt; the guest list is wiped either way. */
    fun resolveGuestTodos(move: Boolean) {
        viewModelScope.launch {
            val signedIn = _session.value ?: return@launch
            _moveFailed.value = false
            if (move) {
                try {
                    mover.move(guest.load(), signedIn)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    _moveFailed.value = true
                    return@launch
                }
            }
            guest.save(emptyList())
            dispatch(AuthEvent.GuestResolved)
            _scope.value = TodoScope.ACCOUNT
        }
    }

    fun signOut() {
        val auth = client ?: return
        viewModelScope.launch {
            auth.signOut()
            wipeAccount()
            guest.save(emptyList())
            _session.value = null
            dispatch(AuthEvent.SignedOut(initiated = true))
            _scope.value = TodoScope.GUEST
        }
    }

    /** Wipes the account cache when a different user signs in on this device. */
    private suspend fun claim(signedIn: AuthSession) {
        if (prefs.getString(OWNER_KEY, null) != signedIn.userId) wipeAccount()
        prefs.edit().putString(OWNER_KEY, signedIn.userId).apply()
    }

    private suspend fun wipeAccount() {
        account.save(emptyList())
        prefs.edit().remove(OWNER_KEY).remove(SYNC_CURSOR_KEY).apply()
    }

    private fun tickResend() {
        viewModelScope.launch {
            do {
                _resendSeconds.value = resendSecondsLeft(_state.value, System.currentTimeMillis())
                delay(1_000)
            } while (_resendSeconds.value > 0)
        }
    }

    private fun dispatch(event: AuthEvent) = _state.update { reduceAuth(it, event) }

    private fun Throwable.kind(): AuthError = (this as? AuthFailure)?.kind ?: AuthError.UNKNOWN

    companion object {
        const val OWNER_KEY = "todo-tracker:account:v1:owner"
        const val SYNC_CURSOR_KEY = "todo-tracker:sync-cursor:v1"
    }
}
