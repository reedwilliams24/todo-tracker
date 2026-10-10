package com.reedwilliams24.todotracker.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoPriority

/** One row per todo; `position` keeps storage order (newest first), like the spec's stored array. */
@Entity(tableName = "todos")
data class TodoEntity(
    @PrimaryKey val id: String,
    val position: Int,
    val title: String,
    val notes: String?,
    val completed: Boolean,
    val priority: String,
    val dueDate: String?,
    val createdAt: String,
    val updatedAt: String,
) {
    fun toTodo() = Todo(
        id = id,
        title = title,
        notes = notes,
        completed = completed,
        priority = TodoPriority.entries.firstOrNull { it.key == priority } ?: TodoPriority.MEDIUM,
        dueDate = dueDate,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun from(todo: Todo, position: Int) = TodoEntity(
            id = todo.id,
            position = position,
            title = todo.title,
            notes = todo.notes,
            completed = todo.completed,
            priority = todo.priority.key,
            dueDate = todo.dueDate,
            createdAt = todo.createdAt,
            updatedAt = todo.updatedAt,
        )
    }
}

@Dao
interface TodoDao {
    @Query("SELECT * FROM todos ORDER BY position")
    suspend fun getAll(): List<TodoEntity>

    @Insert
    suspend fun insertAll(todos: List<TodoEntity>)

    @Query("DELETE FROM todos")
    suspend fun deleteAll()

    @Transaction
    suspend fun replaceAll(todos: List<TodoEntity>) {
        deleteAll()
        insertAll(todos)
    }
}

@Database(entities = [TodoEntity::class], version = 1)
abstract class TodoDatabase : RoomDatabase() {
    abstract fun todos(): TodoDao

    companion object {
        @Volatile private var instance: TodoDatabase? = null

        fun get(context: Context): TodoDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, TodoDatabase::class.java, "todo-tracker.db")
                .build()
                .also { instance = it }
        }
    }
}

class TodoRepository(private val dao: TodoDao) {
    suspend fun load(): List<Todo> = runCatching { dao.getAll().map { it.toTodo() } }.getOrDefault(emptyList())

    suspend fun save(todos: List<Todo>) {
        runCatching { dao.replaceAll(todos.mapIndexed { index, todo -> TodoEntity.from(todo, index) }) }
    }
}
