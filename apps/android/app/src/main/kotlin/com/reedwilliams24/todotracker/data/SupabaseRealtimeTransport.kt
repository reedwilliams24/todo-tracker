package com.reedwilliams24.todotracker.data

import com.reedwilliams24.todotracker.core.REALTIME_SCHEMA
import com.reedwilliams24.todotracker.core.REALTIME_TABLE
import com.reedwilliams24.todotracker.core.RealtimeChannelHandle
import com.reedwilliams24.todotracker.core.RealtimeTransport
import com.reedwilliams24.todotracker.core.RowJson
import com.reedwilliams24.todotracker.core.TodoRow
import com.reedwilliams24.todotracker.core.realtimeTopic
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.datetime.Clock

private val REFRESH_MARGIN = 60.seconds

/** [RealtimeTransport] on supabase-kt: one socket (`client.realtime`) and one channel per open. */
class SupabaseRealtimeTransport(private val client: SupabaseClient) : RealtimeTransport {
    private val main = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override suspend fun refreshAuth() {
        client.auth.awaitInitialization()
        val session = client.auth.currentSessionOrNull() ?: throw IllegalStateException("signed out")
        if (session.expiresAt < Clock.System.now() + REFRESH_MARGIN) client.auth.refreshCurrentSession()
    }

    override suspend fun open(userId: String, onRow: (TodoRow) -> Unit, onClosed: () -> Unit): RealtimeChannelHandle {
        val topic = realtimeTopic(userId)
        val channel = client.channel(topic.channel)
        val changes =
            channel.postgresChangeFlow<PostgresAction>(schema = REALTIME_SCHEMA) {
                table = REALTIME_TABLE
                filter("user_id", FilterOperator.EQ, userId)
            }
        val rows =
            main.launch {
                changes.collect { action ->
                    val record =
                        (action as? PostgresAction.Insert)?.record ?: (action as? PostgresAction.Update)?.record
                    if (record != null) onRow(RowJson.decodeFromJsonElement(TodoRow.serializer(), record))
                }
            }
        try {
            if (client.realtime.status.value != Realtime.Status.CONNECTED) client.realtime.connect()
            channel.subscribe(blockUntilSubscribed = true)
        } catch (e: Throwable) {
            rows.cancel()
            withContext(NonCancellable) { remove(channel) }
            throw e
        }
        val drops =
            main.launch {
                channel.status.drop(1).first { it != RealtimeChannel.Status.SUBSCRIBED }
                onClosed()
            }
        return RealtimeChannelHandle {
            drops.cancel()
            rows.cancel()
            remove(channel)
        }
    }

    private suspend fun remove(channel: RealtimeChannel) {
        runCatching { client.realtime.removeChannel(channel) }
        client.realtime.disconnect()
    }
}
