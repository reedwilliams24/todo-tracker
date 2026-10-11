package com.reedwilliams24.todotracker.core

import kotlin.math.ceil

/** Email-code sign-in state; see spec/features/auth.md. Pure: the app's AuthClient feeds it events. */
const val AUTH_CODE_LENGTH = 6
const val AUTH_RESEND_MS = 60_000L
const val ACCOUNT_STORAGE_KEY = "todo-tracker:account:v1"

enum class AuthError(val key: String) {
    INVALID_EMAIL("invalidEmail"),
    WRONG_CODE("wrongCode"),
    RATE_LIMITED("rateLimited"),
    OFFLINE("offline"),
    UNKNOWN("unknown"),
}

enum class AuthStatus(val key: String) {
    SIGNED_OUT("signedOut"),
    SIGNED_IN("signedIn"),
    EXPIRED("expired"),
}

enum class AuthStep(val key: String) {
    EMAIL("email"),
    CODE("code"),
}

data class AuthState(
    val status: AuthStatus = AuthStatus.SIGNED_OUT,
    /** The open sign-in form's step; null when it is closed. */
    val step: AuthStep? = null,
    val email: String = "",
    val userId: String? = null,
    val busy: Boolean = false,
    val error: AuthError? = null,
    /** Epoch ms after which a new code may be requested. */
    val resendAt: Long? = null,
    /** Guest todo count waiting on the Move/Discard prompt. */
    val movePrompt: Int? = null,
)

sealed interface AuthEvent {
    data object Open : AuthEvent

    data object Cancel : AuthEvent

    data class SendCode(val email: String) : AuthEvent

    data class CodeSent(val now: Long) : AuthEvent

    data class Verify(val code: String) : AuthEvent

    data class Failed(val error: AuthError) : AuthEvent

    data object ChangeEmail : AuthEvent

    data class SignedIn(val userId: String, val email: String, val guestCount: Int) : AuthEvent

    data object GuestResolved : AuthEvent

    data class SignedOut(val initiated: Boolean) : AuthEvent
}

val INITIAL_AUTH_STATE = AuthState()

private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
private val CODE = Regex("^\\d{$AUTH_CODE_LENGTH}$")
private val RATE_LIMIT_CODES = setOf("over_email_send_rate_limit", "over_request_rate_limit")
private val WRONG_CODE_CODES = setOf("otp_expired", "invalid_credentials", "otp_disabled")
private val INVALID_EMAIL_CODES = setOf("email_address_invalid", "validation_failed")

fun normalizeEmail(email: String): String = email.trim().lowercase()

fun isValidEmail(email: String): Boolean = EMAIL.matches(normalizeEmail(email))

/** Keeps the digits of typed or pasted input ("123 456" -> "123456"), at most AUTH_CODE_LENGTH. */
fun normalizeCode(input: String): String = input.filter { it in '0'..'9' }.take(AUTH_CODE_LENGTH)

fun isValidCode(code: String): Boolean = CODE.matches(code)

/** Whole seconds until Resend is allowed; 0 when it is. */
fun resendSecondsLeft(state: AuthState, now: Long): Int {
    val resendAt = state.resendAt ?: return 0
    return maxOf(0, ceil((resendAt - now) / 1000.0).toInt())
}

/** Maps an auth API failure (HTTP status, Supabase `error_code`) to the error shown. No status = offline. */
fun authErrorKind(status: Int?, code: String?): AuthError =
    when {
        status == null || status == 0 -> AuthError.OFFLINE
        status == 429 || code in RATE_LIMIT_CODES -> AuthError.RATE_LIMITED
        code in WRONG_CODE_CODES -> AuthError.WRONG_CODE
        code in INVALID_EMAIL_CODES -> AuthError.INVALID_EMAIL
        status == 403 -> AuthError.WRONG_CODE
        else -> AuthError.UNKNOWN
    }

fun reduceAuth(state: AuthState, event: AuthEvent): AuthState =
    when (event) {
        AuthEvent.Open -> state.copy(step = AuthStep.EMAIL, busy = false, error = null)
        AuthEvent.Cancel -> state.copy(step = null, busy = false, error = null)
        is AuthEvent.SendCode -> {
            val email = normalizeEmail(event.email)
            when {
                state.busy -> state
                !isValidEmail(email) -> state.copy(email = email, error = AuthError.INVALID_EMAIL)
                else -> state.copy(email = email, busy = true, error = null)
            }
        }
        is AuthEvent.CodeSent ->
            state.copy(step = AuthStep.CODE, busy = false, error = null, resendAt = event.now + AUTH_RESEND_MS)
        is AuthEvent.Verify ->
            if (state.busy || !isValidCode(event.code)) state else state.copy(busy = true, error = null)
        is AuthEvent.Failed -> state.copy(busy = false, error = event.error)
        AuthEvent.ChangeEmail -> state.copy(step = AuthStep.EMAIL, busy = false, error = null)
        is AuthEvent.SignedIn ->
            AuthState(
                status = AuthStatus.SIGNED_IN,
                email = normalizeEmail(event.email),
                userId = event.userId,
                movePrompt = event.guestCount.takeIf { it > 0 },
            )
        AuthEvent.GuestResolved -> state.copy(movePrompt = null)
        is AuthEvent.SignedOut ->
            if (event.initiated || state.status == AuthStatus.SIGNED_OUT) INITIAL_AUTH_STATE
            else AuthState(status = AuthStatus.EXPIRED, email = state.email, userId = state.userId)
    }
