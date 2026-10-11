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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reedwilliams24.todotracker.auth.AuthViewModel
import com.reedwilliams24.todotracker.auth.TodoScope
import com.reedwilliams24.todotracker.core.ResolvedTheme
import com.reedwilliams24.todotracker.core.resolveTheme
import com.reedwilliams24.todotracker.ui.AccountMenu
import com.reedwilliams24.todotracker.ui.AuthActions
import com.reedwilliams24.todotracker.ui.AuthBanner
import com.reedwilliams24.todotracker.ui.TodoApp
import com.reedwilliams24.todotracker.ui.TodoTheme

class MainActivity : ComponentActivity() {
    private val viewModel: TodoViewModel by viewModels()
    private val auth: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val preference by viewModel.theme.collectAsStateWithLifecycle()
            val dark = resolveTheme(preference, isSystemInDarkTheme()) == ResolvedTheme.DARK
            DisposableEffect(dark) {
                val bars =
                    if (dark) {
                        SystemBarStyle.dark(Color.TRANSPARENT)
                    } else {
                        SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                    }
                enableEdgeToEdge(statusBarStyle = bars, navigationBarStyle = bars)
                onDispose {}
            }
            TodoTheme(dark) {
                if (!auth.configured) {
                    TodoApp(viewModel)
                } else {
                    val scope by auth.scope.collectAsStateWithLifecycle()
                    val state by auth.state.collectAsStateWithLifecycle()
                    val resendSeconds by auth.resendSeconds.collectAsStateWithLifecycle()
                    val session by auth.session.collectAsStateWithLifecycle()
                    val moveFailed by auth.moveFailed.collectAsStateWithLifecycle()
                    val userId = session?.userId
                    LaunchedEffect(scope, userId) {
                        val server = auth.syncServer
                        viewModel.useScope(
                            scope,
                            if (scope == TodoScope.ACCOUNT && server != null && userId != null) {
                                SyncSetup(server, userId, auth.realtime)
                            } else {
                                null
                            },
                        )
                    }
                    val actions = remember {
                        AuthActions(
                            open = auth::open,
                            cancel = auth::cancel,
                            sendCode = auth::sendCode,
                            resend = auth::resend,
                            verify = auth::verify,
                            changeEmail = auth::changeEmail,
                            resolveGuestTodos = auth::resolveGuestTodos,
                            signOut = auth::signOut,
                        )
                    }
                    TodoApp(
                        viewModel,
                        account = { AccountMenu(state, actions) },
                        banner = { AuthBanner(state, resendSeconds, actions, moveFailed) },
                    )
                }
            }
        }
    }
}
