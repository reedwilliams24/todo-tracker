package com.reedwilliams24.todotracker.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

/** Public Supabase config; `null` from [cloudConfig] means "cloud disabled, stay local-only". */
@Serializable
data class CloudConfig(val url: String, val anonKey: String)

fun cloudConfig(url: String?, anonKey: String?): CloudConfig? =
    if (url.isNullOrEmpty() || anonKey.isNullOrEmpty()) null else CloudConfig(url, anonKey)

/** Row shape of the `todos` table (see supabase/migrations). */
@Serializable
data class TodoRow(
    val id: String,
    @SerialName("user_id") val userId: String,
    val data: Todo,
    val completed: Boolean,
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("updated_at") val updatedAt: String,
)

fun toRow(todo: Todo, userId: String) = TodoRow(
    id = todo.id,
    userId = userId,
    data = todo,
    completed = todo.completed,
    dueDate = todo.dueDate,
    updatedAt = todo.updatedAt,
)

fun fromRow(row: TodoRow): Todo = row.data

/** Wire JSON for a row. `due_date` is an explicit null so an upsert clears a removed due date. */
fun TodoRow.toJson(): JsonObject = buildJsonObject {
    put("id", id)
    put("user_id", userId)
    put("data", TodoJson.encodeToJsonElement(Todo.serializer(), data))
    put("completed", completed)
    put("due_date", dueDate?.let(::JsonPrimitive) ?: JsonNull)
    put("updated_at", updatedAt)
}

/** Last-synced `updatedAt` per todo id, in list order. */
@Serializable
data class CloudVersion(val id: String, val updatedAt: String)

@Serializable
data class CloudSavePlan(val changed: List<Todo>, val removed: List<String>)

fun cloudVersions(todos: List<Todo>): List<CloudVersion> = todos.map { CloudVersion(it.id, it.updatedAt) }

/** Upsert new or changed todos, delete last-synced ids that are gone. */
fun planCloudSave(known: List<CloudVersion>, todos: List<Todo>): CloudSavePlan {
    val versions = known.associate { it.id to it.updatedAt }
    val ids = todos.mapTo(HashSet()) { it.id }
    return CloudSavePlan(
        changed = todos.filter { versions[it.id] != it.updatedAt },
        removed = known.map { it.id }.filter { it !in ids },
    )
}

/** Per-account flag key recording that the signed-out list was merged in on this device. */
fun migrationKey(userId: String) = "todo-tracker:migrated:$userId"

/** Account order first, local-only todos appended; a local copy wins only if strictly newer. */
fun mergeLocalIntoAccount(local: List<Todo>, remote: List<Todo>): List<Todo> {
    val byId = LinkedHashMap<String, Todo>()
    remote.forEach { byId[it.id] = it }
    for (todo in local) {
        val existing = byId[todo.id]
        if (existing == null || existing.updatedAt < todo.updatedAt) byId[todo.id] = todo
    }
    return byId.values.toList()
}

/** Realtime channel for the user's todo rows. */
fun realtimeTopic(userId: String) = "todos:$userId"

/** Realtime `postgres_changes` subscription for the user's todo rows (RLS also applies to the feed). */
@Serializable
data class TodoChangeFilter(val event: String, val schema: String, val table: String, val filter: String)

fun todoChangeFilter(userId: String) = TodoChangeFilter(event = "*", schema = "public", table = "todos", filter = "user_id=eq.$userId")

@Serializable
data class RemoteMerge(val todos: List<Todo>, val changed: Boolean)

/**
 * Folds the account's rows ([remote]) into this device's list after a change elsewhere. [known] is the
 * last-synced snapshot: unsaved local adds, edits and deletes win; everything else follows [remote].
 * Local order is kept and todos added elsewhere go first, newest first.
 */
fun mergeRemoteTodos(local: List<Todo>, remote: List<Todo>, known: List<CloudVersion>): RemoteMerge {
    val versions = known.associate { it.id to it.updatedAt }
    val remoteById = remote.associateBy { it.id }
    val localIds = local.mapTo(HashSet()) { it.id }
    val added = remote.filter { it.id !in localIds && it.id !in versions }.sortedByDescending { it.createdAt }
    val kept = local.mapNotNull { todo ->
        val theirs = remoteById[todo.id]
        val synced = versions[todo.id]
        when {
            theirs != null -> if (synced == todo.updatedAt) theirs else todo
            synced == null -> todo
            else -> null
        }
    }
    val todos = added + kept
    val changed = todos.size != local.size ||
        todos.zip(local).any { (a, b) -> a.id != b.id || a.updatedAt != b.updatedAt }
    return RemoteMerge(todos, changed)
}

/** Device key holding the signed-in account's cached list and last-synced snapshot. */
fun syncKey(userId: String) = "todo-tracker:sync:$userId"

/**
 * Merges two edits of the same todo field by field against the last-synced copy ([base]): a field changed on
 * one side only takes that side's value; a field changed on both takes the newer copy's value (remote on a
 * tie). `updatedAt` becomes the latest of [now] and both copies.
 */
fun mergeTodoFields(base: Todo?, local: Todo, remote: Todo, now: Instant): Todo {
    val localNewer = local.updatedAt > remote.updatedAt
    fun <T> pick(field: (Todo) -> T): T {
        val mine = field(local)
        val theirs = field(remote)
        return when {
            mine == theirs -> theirs
            base != null && mine == field(base) -> theirs
            base != null && theirs == field(base) -> mine
            localNewer -> mine
            else -> theirs
        }
    }
    return remote.copy(
        title = pick { it.title },
        notes = pick { it.notes },
        completed = pick { it.completed },
        priority = pick { it.priority },
        dueDate = pick { it.dueDate },
        createdAt = pick { it.createdAt },
        updatedAt = maxOf(timestamp(now), local.updatedAt, remote.updatedAt),
    )
}

@Serializable
data class SyncPlan(val todos: List<Todo>, val push: List<Todo>, val remove: List<String>, val changed: Boolean)

/**
 * Reconciles this device's cached list with the account's rows. [base] is the last-synced list, or `null`
 * before the first sync on this device (then [mergeLocalIntoAccount] folds the signed-out list in). Otherwise
 * [mergeRemoteTodos] applies, todos edited on both sides merge per field, and deletes on either side win.
 */
fun planSync(local: List<Todo>, remote: List<Todo>, base: List<Todo>?, now: Instant): SyncPlan {
    val todos = if (base == null) {
        mergeLocalIntoAccount(local, remote)
    } else {
        val baseById = base.associateBy { it.id }
        val remoteById = remote.associateBy { it.id }
        mergeRemoteTodos(local, remote, cloudVersions(base)).todos.map { todo ->
            val theirs = remoteById[todo.id]
            val synced = baseById[todo.id]
            val bothEdited = theirs != null && todo != theirs &&
                todo.updatedAt != synced?.updatedAt && theirs.updatedAt != synced?.updatedAt
            if (bothEdited) mergeTodoFields(synced, todo, theirs!!, now) else todo
        }
    }
    val plan = planCloudSave(cloudVersions(remote), todos)
    val changed = todos.size != local.size ||
        todos.zip(local).any { (a, b) -> a.id != b.id || a.updatedAt != b.updatedAt }
    return SyncPlan(todos, plan.changed, plan.removed, changed)
}

/** Local changes not yet in the account: adds, edits and deletes since [base]. */
fun pendingChanges(local: List<Todo>, base: List<Todo>?): Int {
    val plan = planCloudSave(cloudVersions(base.orEmpty()), local)
    return plan.changed.size + plan.removed.size
}

/** Text after "Signed in as <email> · " in the account panel. */
fun syncStatus(pending: Int): String =
    if (pending == 0) "syncing across devices" else "$pending ${if (pending == 1) "change" else "changes"} waiting to sync"
