package com.reedwilliams24.todotracker.data

import com.reedwilliams24.todotracker.core.RowJson
import com.reedwilliams24.todotracker.core.SyncServer
import com.reedwilliams24.todotracker.core.TodoRow
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.buildJsonObject

/** `push_todos` + the incremental pull from spec/server.md, as the signed-in user (RLS). */
class SupabaseSyncServer(private val client: SupabaseClient) : SyncServer {
    private val rowList = ListSerializer(TodoRow.serializer())

    override suspend fun push(rows: List<TodoRow>): List<TodoRow> {
        val params = buildJsonObject { put("rows", RowJson.encodeToJsonElement(rowList, rows)) }
        return RowJson.decodeFromString(rowList, client.postgrest.rpc("push_todos", params).data)
    }

    override suspend fun pull(cursor: Long, limit: Int): List<TodoRow> {
        val result =
            client.from("todos").select {
                filter { gt("server_seq", cursor) }
                order("server_seq", Order.ASCENDING)
                limit(limit.toLong())
            }
        return RowJson.decodeFromString(rowList, result.data)
    }
}
