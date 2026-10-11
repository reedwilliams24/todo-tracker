package com.reedwilliams24.todotracker.reminders

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.reedwilliams24.todotracker.MainActivity
import com.reedwilliams24.todotracker.core.Reminder
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.planReminders
import com.reedwilliams24.todotracker.core.pruneDelivered
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Delivers the core's planned reminders (spec/features/reminders.md): due ones are posted now,
 * future ones get an inexact alarm. A key counts as handled once it is posted or scheduled.
 */
class ReminderScheduler(context: Context) {
    private val context = context.applicationContext
    private val prefs = this.context.getSharedPreferences("reminders", Context.MODE_PRIVATE)
    private val notifications = this.context.getSystemService(NotificationManager::class.java)
    private val alarms = this.context.getSystemService(AlarmManager::class.java)

    fun sync(todos: List<Todo>, now: LocalDateTime = LocalDateTime.now()) {
        val stored = prefs.getStringSet(DELIVERED_KEY, emptySet()).orEmpty()
        val handled = pruneDelivered(stored, todos).toMutableSet()
        (stored - handled).forEach { key -> pendingIntent(key, null, PendingIntent.FLAG_NO_CREATE)?.let(alarms::cancel) }

        if (notifications.areNotificationsEnabled()) {
            ensureChannel(context)
            for (reminder in planReminders(todos)) {
                if (reminder.key in handled) continue
                if (reminder.at.isAfter(now)) {
                    val at = reminder.at.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    alarms.set(AlarmManager.RTC_WAKEUP, at, pendingIntent(reminder.key, reminder, 0)!!)
                } else {
                    post(context, reminder.key, reminder.title, reminder.body)
                }
                handled += reminder.key
            }
        }
        prefs.edit().putStringSet(DELIVERED_KEY, handled).apply()
    }

    private fun pendingIntent(key: String, reminder: Reminder?, flags: Int): PendingIntent? {
        val intent = Intent(context, ReminderReceiver::class.java)
            .setData(Uri.parse("todo-reminder:$key"))
            .putExtra(EXTRA_KEY, key)
            .putExtra(EXTRA_TITLE, reminder?.title)
            .putExtra(EXTRA_BODY, reminder?.body)
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            flags or PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    companion object {
        const val DELIVERED_KEY = "todo-tracker:reminders-delivered"
        private const val CHANNEL_ID = "reminders"
        private const val EXTRA_KEY = "key"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_BODY = "body"

        private fun ensureChannel(context: Context) {
            val channel = NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_HIGH)
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        internal fun post(context: Context, key: String, title: String, body: String) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (!manager.areNotificationsEnabled()) return
            ensureChannel(context)
            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(open)
                .setAutoCancel(true)
                .build()
            manager.notify(key, 0, notification)
        }

        internal fun fromIntent(context: Context, intent: Intent) {
            val key = intent.getStringExtra(EXTRA_KEY) ?: return
            post(context, key, intent.getStringExtra(EXTRA_TITLE) ?: return, intent.getStringExtra(EXTRA_BODY) ?: return)
        }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = ReminderScheduler.fromIntent(context, intent)
}
