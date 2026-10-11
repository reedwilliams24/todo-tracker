package com.reedwilliams24.todotracker.data

import android.content.Context
import com.reedwilliams24.todotracker.core.CloudConfig
import com.reedwilliams24.todotracker.core.CloudVersion
import com.reedwilliams24.todotracker.core.RemoteMerge
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoJson
import com.reedwilliams24.todotracker.core.TodoRow
import com.reedwilliams24.todotracker.core.cloudVersions
import com.reedwilliams24.todotracker.core.fromRow
import com.reedwilliams24.todotracker.core.migrationKey
import com.reedwilliams24.todotracker.core.mergeLocalIntoAccount
import com.reedwilliams24.todotracker.core.mergeRemoteTodos
import com.reedwilliams24.todotracker.core.planCloudSave
import com.reedwilliams24.todotracker.core.toJson
import com.reedwilliams24.todotracker.core.toRow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class AuthUser(val id: String, val email: String?)

data class AuthSession(val accessToken: String, val refreshToken: String, val expiresAt: Long, val user: AuthUser)

class SupabaseException(val status: Int, message: String) : Exception(message)

const val AUTH_REDIRECT = "todotracker://auth"

/** Minimal Supabase Auth (GoTrue) + PostgREST client over HttpURLConnection; only the anon key ships. */
class SupabaseClient(val config: CloudConfig) {
    private val base = config.url.trimEnd('/')

    suspend fun sendCode(email: String) {
        request("POST", "/auth/v1/otp", buildJsonObject { put("email", email); put("create_user", true) })
    }

    suspend fun verifyCode(email: String, code: String): AuthSession = parseSession(
        request("POST", "/auth/v1/verify", buildJsonObject { put("type", "email"); put("email", email); put("token", code) }),
    )

    suspend fun refresh(session: AuthSession): AuthSession = parseSession(
        request("POST", "/auth/v1/token?grant_type=refresh_token", buildJsonObject { put("refresh_token", session.refreshToken) }),
    )

    fun authorizeUrl(provider: String): String =
        "$base/auth/v1/authorize?provider=$provider&redirect_to=${encode(AUTH_REDIRECT)}"

    /** Completes an OAuth redirect: `todotracker://auth#access_token=…&refresh_token=…&expires_in=…`. */
    suspend fun sessionFromRedirect(params: Map<String, String>): AuthSession {
        params["error_description"]?.let { throw SupabaseException(400, it) }
        val accessToken = params["access_token"] ?: throw SupabaseException(400, "Sign-in was cancelled.")
        val user = parseUser(TodoJson.parseToJsonElement(request("GET", "/auth/v1/user", token = accessToken)).jsonObject)
        return AuthSession(
            accessToken = accessToken,
            refreshToken = params["refresh_token"].orEmpty(),
            expiresAt = nowSeconds() + (params["expires_in"]?.toLongOrNull() ?: 3600),
            user = user,
        )
    }

    suspend fun signOut(session: AuthSession) {
        runCatching { request("POST", "/auth/v1/logout", token = session.accessToken) }
    }

    suspend fun listTodos(token: String, userId: String): List<TodoRow> = TodoJson.decodeFromString(
        ListSerializer(TodoRow.serializer()),
        request("GET", "/rest/v1/todos?select=*&user_id=eq.${encode(userId)}", token = token),
    )

    suspend fun upsertTodos(token: String, rows: List<TodoRow>) {
        request(
            "POST",
            "/rest/v1/todos?on_conflict=id",
            JsonArray(rows.map { it.toJson() }),
            token,
            mapOf("Prefer" to "resolution=merge-duplicates,return=minimal"),
        )
    }

    suspend fun removeTodos(token: String, userId: String, ids: List<String>) {
        val list = ids.joinToString(",") { "\"" + it.replace("\"", "") + "\"" }
        request("DELETE", "/rest/v1/todos?user_id=eq.${encode(userId)}&id=in.${encode("($list)")}", token = token)
    }

    private suspend fun request(
        method: String,
        path: String,
        body: JsonElement? = null,
        token: String? = null,
        headers: Map<String, String> = emptyMap(),
    ): String = withContext(Dispatchers.IO) {
        val connection = URL(base + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("apikey", config.anonKey)
            connection.setRequestProperty("Authorization", "Bearer ${token ?: config.anonKey}")
            connection.setRequestProperty("Content-Type", "application/json")
            headers.forEach(connection::setRequestProperty)
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw SupabaseException(status, errorMessage(text, status))
            text
        } finally {
            connection.disconnect()
        }
    }

    private fun parseSession(text: String): AuthSession {
        val json = TodoJson.parseToJsonElement(text).jsonObject
        return AuthSession(
            accessToken = json.string("access_token")!!,
            refreshToken = json.string("refresh_token").orEmpty(),
            expiresAt = json["expires_at"]?.jsonPrimitive?.long ?: (nowSeconds() + (json["expires_in"]?.jsonPrimitive?.long ?: 3600)),
            user = parseUser(json.getValue("user").jsonObject),
        )
    }

    private fun parseUser(json: JsonObject) = AuthUser(json.string("id")!!, json.string("email"))

    private fun errorMessage(text: String, status: Int): String {
        val json = runCatching { TodoJson.parseToJsonElement(text).jsonObject }.getOrNull()
        return listOf("msg", "message", "error_description", "error").firstNotNullOfOrNull { json?.string(it) }
            ?: "Request failed ($status)"
    }

    private fun JsonObject.string(key: String): String? = (get(key) as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull

    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
}

internal fun nowSeconds() = System.currentTimeMillis() / 1000

/** Keeps the signed-in session (and per-account migration flags) on the device; refreshes the token when needed. */
class AccountSession(val client: SupabaseClient, context: Context) {
    private val prefs = context.getSharedPreferences("account", Context.MODE_PRIVATE)
    var session: AuthSession? = readSession()
        private set

    fun store(session: AuthSession?) {
        this.session = session
        prefs.edit().apply {
            if (session == null) {
                remove(SESSION)
            } else {
                putString(
                    SESSION,
                    buildJsonObject {
                        put("access_token", session.accessToken)
                        put("refresh_token", session.refreshToken)
                        put("expires_at", session.expiresAt)
                        put("user", buildJsonObject { put("id", session.user.id); put("email", session.user.email) })
                    }.toString(),
                )
            }
        }.apply()
    }

    suspend fun signOut() {
        session?.let { client.signOut(it) }
        store(null)
    }

    fun isMigrated(userId: String) = prefs.getBoolean(migrationKey(userId), false)
    fun setMigrated(userId: String) = prefs.edit().putBoolean(migrationKey(userId), true).apply()

    /** Runs [block] with a valid access token, refreshing once if it is about to expire or is rejected. */
    suspend fun <T> authorized(block: suspend (String) -> T): T {
        var current = session ?: throw SupabaseException(401, "Not signed in.")
        if (current.expiresAt - 60 < nowSeconds()) current = client.refresh(current).also(::store)
        return try {
            block(current.accessToken)
        } catch (error: SupabaseException) {
            if (error.status != 401) throw error
            block(client.refresh(current).also(::store).accessToken)
        }
    }

    private fun readSession(): AuthSession? = runCatching {
        val json = TodoJson.parseToJsonElement(prefs.getString(SESSION, null)!!).jsonObject
        val user = json.getValue("user").jsonObject
        AuthSession(
            accessToken = json.getValue("access_token").jsonPrimitive.content,
            refreshToken = json.getValue("refresh_token").jsonPrimitive.content,
            expiresAt = json.getValue("expires_at").jsonPrimitive.long,
            user = AuthUser(user.getValue("id").jsonPrimitive.content, user["email"]?.jsonPrimitive?.contentOrNull),
        )
    }.getOrNull()

    private companion object {
        const val SESSION = "session"
    }
}

interface TodoStore {
    suspend fun load(): List<Todo>
    suspend fun save(todos: List<Todo>)

    /** Cloud only: fetches the account's rows and folds them into [local] (read after the fetch) after a change elsewhere. */
    suspend fun reload(local: () -> List<Todo>): RemoteMerge? = null
}

/** The account's `todos` rows; saves send only the diff from the last load/save (planCloudSave). */
class CloudTodoStore(private val account: AccountSession, private val userId: String) : TodoStore {
    private var known: List<CloudVersion> = emptyList()

    override suspend fun load(): List<Todo> {
        val todos = account.authorized { account.client.listTodos(it, userId) }.map(::fromRow)
        known = cloudVersions(todos)
        return todos
    }

    override suspend fun save(todos: List<Todo>) {
        val plan = planCloudSave(known, todos)
        if (plan.changed.isNotEmpty()) account.authorized { token -> account.client.upsertTodos(token, plan.changed.map { toRow(it, userId) }) }
        if (plan.removed.isNotEmpty()) account.authorized { account.client.removeTodos(it, userId, plan.removed) }
        known = cloudVersions(todos)
    }

    override suspend fun reload(local: () -> List<Todo>): RemoteMerge {
        val remote = account.authorized { account.client.listTodos(it, userId) }.map(::fromRow)
        return mergeRemoteTodos(local(), remote, known).also { known = cloudVersions(remote) }
    }
}

/** On the first sign-in on this device, folds the signed-out list into the account once. */
class FirstSignInMigration(
    private val cloud: TodoStore,
    private val local: TodoStore,
    private val account: AccountSession,
    private val userId: String,
) : TodoStore {
    override suspend fun load(): List<Todo> {
        val remote = cloud.load()
        if (account.isMigrated(userId)) return remote
        val merged = mergeLocalIntoAccount(local.load(), remote)
        cloud.save(merged)
        account.setMigrated(userId)
        return merged
    }

    override suspend fun save(todos: List<Todo>) = cloud.save(todos)

    override suspend fun reload(local: () -> List<Todo>) = cloud.reload(local)
}
