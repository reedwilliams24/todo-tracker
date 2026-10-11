package com.reedwilliams24.todotracker.data

import android.content.Context
import androidx.room.AutoMigration
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import com.reedwilliams24.todotracker.core.Recurrence
import com.reedwilliams24.todotracker.core.ReminderOffset
import com.reedwilliams24.todotracker.core.Subtask
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoJson
import com.reedwilliams24.todotracker.core.TodoPriority
import kotlinx.serialization.builtins.ListSerializer

private val subtaskList = ListSerializer(Subtask.serializer())

/**
 * One row per todo; `position` keeps storage order (newest first), like the spec's stored array. `subtasks` is the JSON
 * array from spec/schema/todo.schema.json, or null when there are none.
 */
@Entity(tableName = "todos")
data class TodoEntity(
    @PrimaryKey val id: String,
    val position: Int,
    val title: String,
    val notes: String?,
    val completed: Boolean,
    val priority: String,
    val dueDate: String?,
    @ColumnInfo(defaultValue = "NULL") val reminder: String?,
    @ColumnInfo(defaultValue = "NULL") val recurrence: String?,
    val createdAt: String,
    val updatedAt: String,
    val completedAt: String? = null,
    val subtasks: String? = null,
) {
    fun toTodo() =
        Todo(
            id = id,
            title = title,
            notes = notes,
            completed = completed,
            priority = TodoPriority.entries.firstOrNull { it.key == priority } ?: TodoPriority.MEDIUM,
            dueDate = dueDate,
            reminder = ReminderOffset.fromKey(reminder),
            recurrence = recurrence?.let(Recurrence::fromKey),
            createdAt = createdAt,
            updatedAt = updatedAt,
            completedAt = completedAt,
            subtasks =
                subtasks
                    ?.let { runCatching { TodoJson.decodeFromString(subtaskList, it) }.getOrNull() }
                    ?.ifEmpty { null },
        )

    companion object {
        fun from(todo: Todo, position: Int) =
            TodoEntity(
                id = todo.id,
                position = position,
                title = todo.title,
                notes = todo.notes,
                completed = todo.completed,
                priority = todo.priority.key,
                dueDate = todo.dueDate,
                reminder = todo.reminder?.key,
                recurrence = todo.recurrence?.key,
                createdAt = todo.createdAt,
                updatedAt = todo.updatedAt,
                completedAt = todo.completedAt,
                subtasks = todo.subtasks?.ifEmpty { null }?.let { TodoJson.encodeToString(subtaskList, it) },
            )
    }
}

@Dao
interface TodoDao {
    @Query("SELECT * FROM todos ORDER BY position") suspend fun getAll(): List<TodoEntity>

    @Insert suspend fun insertAll(todos: List<TodoEntity>)

    @Query("DELETE FROM todos") suspend fun deleteAll()

    @Transaction
    suspend fun replaceAll(todos: List<TodoEntity>) {
        deleteAll()
        insertAll(todos)
    }
}

@Database(
    entities = [TodoEntity::class],
    version = 5,
    autoMigrations =
        [
            AutoMigration(from = 1, to = 2),
            AutoMigration(from = 2, to = 3),
            AutoMigration(from = 3, to = 4),
            AutoMigration(from = 4, to = 5),
        ],
)
abstract class TodoDatabase : RoomDatabase() {
    abstract fun todos(): TodoDao

    companion object {
        /** The guest list (signed out). */
        const val GUEST = "todo-tracker.db"

        /** The signed-in account's local cache, wiped on sign out. */
        const val ACCOUNT = "todo-tracker-account.db"

        private val instances = mutableMapOf<String, TodoDatabase>()

        fun get(context: Context, name: String = GUEST): TodoDatabase =
            synchronized(this) {
                instances.getOrPut(name) {
                    Room.databaseBuilder(context.applicationContext, TodoDatabase::class.java, name).build()
                }
            }
    }
}

class TodoRepository(private val dao: TodoDao) {
    suspend fun load(): List<Todo> = runCatching { dao.getAll().map { it.toTodo() } }.getOrDefault(emptyList())

    suspend fun save(todos: List<Todo>) {
        runCatching { dao.replaceAll(todos.mapIndexed { index, todo -> TodoEntity.from(todo, index) }) }
    }
}
