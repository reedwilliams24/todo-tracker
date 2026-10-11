package com.reedwilliams24.todotracker

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reedwilliams24.todotracker.core.ResolvedTheme
import com.reedwilliams24.todotracker.core.resolveTheme
import com.reedwilliams24.todotracker.ui.TodoApp
import com.reedwilliams24.todotracker.ui.TodoTheme

class MainActivity : ComponentActivity() {
    private val viewModel: TodoViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val preference by viewModel.theme.collectAsStateWithLifecycle()
            val dark = resolveTheme(preference, isSystemInDarkTheme()) == ResolvedTheme.DARK
            DisposableEffect(dark) {
                val bars = if (dark) {
                    SystemBarStyle.dark(Color.TRANSPARENT)
                } else {
                    SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                }
                enableEdgeToEdge(statusBarStyle = bars, navigationBarStyle = bars)
                onDispose {}
            }
            TodoTheme(dark) { TodoApp(viewModel) }
        }
    }
}
