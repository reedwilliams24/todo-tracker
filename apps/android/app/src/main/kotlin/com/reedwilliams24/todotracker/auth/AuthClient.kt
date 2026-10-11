package com.reedwilliams24.todotracker.auth

import android.content.Context
import com.reedwilliams24.todotracker.BuildConfig
import com.reedwilliams24.todotracker.core.AuthError
import com.reedwilliams24.todotracker.core.SyncServer
import com.reedwilliams24.todotracker.core.authErrorKind
import com.reedwilliams24.todotracker.data.SupabaseSyncServer
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.exception.AuthRestException
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.ktor.client.plugins.HttpRequestTimeoutException
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filterNot
import kotlinx.coroutines.flow.map

/** The signed-in user, as later tickets (sync, delete account) need it. */
data class AuthSession(val userId: String, val email: String, val accessToken: String)

/** A session change: [initiated] is false when the session ended on its own (expired refresh token). */
data class AuthChange(val session: AuthSession?, val initiated: Boolean)

class AuthFailure(val kind: AuthError, cause: Throwable) : Exception(cause)

/** Email-code sign-in and the persisted session. Supabase-backed; null when the build has no Supabase config. */
interface AuthClient {
    /** Emits once the stored session is restored, then on every sign-in, sign-out and expiry. */
    val changes: Flow<AuthChange>

    /** The todos backend, as the signed-in user. */
    val sync: SyncServer

    suspend fun sendCode(email: String)

    suspend fun verifyCode(email: String, code: String): AuthSession

    suspend fun signOut()

    companion object {
        val configured: Boolean
            get() = BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()

        fun create(context: Context): AuthClient? =
            if (configured) SupabaseAuthClient(context.applicationContext) else null
    }
}

private class SupabaseAuthClient(context: Context) : AuthClient {
    // supabase-kt's Android lifecycle callbacks pause token refresh in the background and resume it on start.
    private val client: SupabaseClient =
        createSupabaseClient(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY) {
            install(Auth) { sessionManager = EncryptedSessionManager(context) }
            install(Postgrest)
        }
    private var signingOut = false

    override val changes: Flow<AuthChange> =
        client.auth.sessionStatus
            .filterNot { it is SessionStatus.Initializing || it is SessionStatus.RefreshFailure }
            .map { status ->
                when (status) {
                    is SessionStatus.Authenticated -> AuthChange(status.session.toAuthSession(), initiated = true)
                    else -> AuthChange(null, initiated = signingOut).also { signingOut = false }
                }
            }

    override val sync: SyncServer = SupabaseSyncServer(client.postgrest)

    override suspend fun sendCode(email: String) = mapErrors {
        client.auth.signInWith(OTP) {
            this.email = email
            createUser = true
        }
    }

    override suspend fun verifyCode(email: String, code: String): AuthSession = mapErrors {
        client.auth.verifyEmailOtp(type = OtpType.Email.EMAIL, email = email, token = code)
        client.auth.currentSessionOrNull()?.toAuthSession() ?: throw IllegalStateException("no session")
    }

    override suspend fun signOut() {
        signingOut = true
        // REED-68's Realtime socket closes here too; the local session is cleared even if the server call fails.
        runCatching { client.auth.signOut() }.onFailure { client.auth.clearSession() }
    }

    private suspend fun <T> mapErrors(block: suspend () -> T): T =
        try {
            block()
        } catch (e: AuthRestException) {
            throw AuthFailure(authErrorKind(e.statusCode, e.error), e)
        } catch (e: RestException) {
            throw AuthFailure(authErrorKind(e.statusCode, e.error), e)
        } catch (e: HttpRequestException) {
            throw AuthFailure(AuthError.OFFLINE, e)
        } catch (e: HttpRequestTimeoutException) {
            throw AuthFailure(AuthError.OFFLINE, e)
        } catch (e: IOException) {
            throw AuthFailure(AuthError.OFFLINE, e)
        }
}

private fun io.github.jan.supabase.auth.user.UserSession.toAuthSession(): AuthSession? {
    val user = user ?: return null
    return AuthSession(userId = user.id, email = user.email.orEmpty(), accessToken = accessToken)
}
