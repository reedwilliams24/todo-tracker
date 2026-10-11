package com.reedwilliams24.todotracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.reedwilliams24.todotracker.MainActivity
import com.reedwilliams24.todotracker.R
import com.reedwilliams24.todotracker.core.TODAY_LIMIT
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.todayMoreLabel
import com.reedwilliams24.todotracker.core.todaySubtitle
import com.reedwilliams24.todotracker.core.todaySummary
import com.reedwilliams24.todotracker.data.TodoDatabase
import com.reedwilliams24.todotracker.data.TodoRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** "Today" home-screen widget (spec/features/today.md). Reads the same Room database as the app. */
class TodayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val pending = goAsync()
        scope.launch {
            try {
                val todos = TodoRepository(TodoDatabase.get(context).todos()).load()
                render(context, manager, ids, todos)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        private val itemIds = intArrayOf(
            R.id.widget_item_0,
            R.id.widget_item_1,
            R.id.widget_item_2,
            R.id.widget_item_3,
            R.id.widget_item_4,
        )

        /** Redraws every placed widget from `todos`; the app calls this after each save. */
        fun refresh(context: Context, todos: List<Todo>) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
            if (ids.isNotEmpty()) render(context, manager, ids, todos)
        }

        private fun render(context: Context, manager: AppWidgetManager, ids: IntArray, todos: List<Todo>) {
            val summary = todaySummary(todos, limit = minOf(TODAY_LIMIT, itemIds.size))
            val views = RemoteViews(context.packageName, R.layout.widget_today)
            views.setTextViewText(R.id.widget_subtitle, todaySubtitle(summary))
            views.setTextColor(
                R.id.widget_subtitle,
                context.getColor(if (summary.overdue > 0) R.color.widget_danger else R.color.widget_muted),
            )
            itemIds.forEachIndexed { index, viewId ->
                val todo = summary.todos.getOrNull(index)
                views.setViewVisibility(viewId, if (todo == null) View.GONE else View.VISIBLE)
                views.setTextViewText(viewId, todo?.let { "○ ${it.title}" } ?: "")
            }
            val more = todayMoreLabel(summary)
            views.setViewVisibility(R.id.widget_more, if (more == null) View.GONE else View.VISIBLE)
            views.setTextViewText(R.id.widget_more, more ?: "")
            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, open)
            manager.updateAppWidget(ids, views)
        }
    }
}
