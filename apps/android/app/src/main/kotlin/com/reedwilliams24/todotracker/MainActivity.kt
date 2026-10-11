package com.reedwilliams24.todotracker

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.reedwilliams24.todotracker.core.sharedTextFromQuery
import com.reedwilliams24.todotracker.ui.TodoApp

class MainActivity : ComponentActivity() {
    private val viewModel: TodoViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(0, 0))
        setContent { TodoApp(viewModel) }
        // A recreated activity (rotation, process death) gets the same intent again; it was already handled.
        if (savedInstanceState == null) handleShare(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShare(intent)
    }

    private fun handleShare(intent: Intent?) {
        val texts = intent?.let(::sharedTexts).orEmpty()
        if (texts.isNotEmpty()) viewModel.addShared(texts)
    }
}

/** Text from the share sheet (`ACTION_SEND`) or a `todotracker://add?add=…` link (spec/features/share.md). */
internal fun sharedTexts(intent: Intent): List<String> = when (intent.action) {
    Intent.ACTION_SEND -> listOfNotNull(
        intent.getStringExtra(Intent.EXTRA_SUBJECT),
        intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString(),
    )
    Intent.ACTION_VIEW -> intent.data
        ?.takeIf { it.scheme == "todotracker" && it.host == "add" }
        ?.let { sharedTextFromQuery(it.encodedQuery.orEmpty()) }
        .orEmpty()
    else -> emptyList()
}
