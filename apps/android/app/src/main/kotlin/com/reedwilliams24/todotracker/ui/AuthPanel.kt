package com.reedwilliams24.todotracker.ui

import com.reedwilliams24.todotracker.core.syncStatus
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.reedwilliams24.todotracker.AuthUiState
import com.reedwilliams24.todotracker.TodoViewModel
import com.reedwilliams24.todotracker.core.TestIds

/** Optional sign-in (spec/features/account.md). Not shown when the build has no Supabase config. */
@Composable
fun AuthPanel(auth: AuthUiState, viewModel: TodoViewModel) {
    if (!auth.enabled) return
    val shape = RoundedCornerShape(Radius.lg)
    val card = Modifier
        .fillMaxWidth()
        .clip(shape)
        .border(1.dp, Palette.border, shape)
        .background(Palette.card.copy(alpha = 0.6f))
        .testTag(TestIds.authPanel)

    val user = auth.user
    if (user != null) {
        Row(
            card.padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Signed in as ${user.email ?: user.id} · ${syncStatus(auth.unsynced)}",
                fontSize = FontSize.sm,
                color = Palette.foreground.copy(alpha = 0.8f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).testTag(TestIds.authUser),
            )
            Text(
                "Sign out",
                fontSize = FontSize.sm,
                color = Palette.foreground.copy(alpha = 0.7f),
                textDecoration = TextDecoration.Underline,
                modifier = Modifier
                    .clickable(enabled = !auth.busy, role = Role.Button, onClick = viewModel::signOut)
                    .testTag(TestIds.authSignOut),
            )
        }
        return
    }

    var email by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    val uriHandler = LocalUriHandler.current

    Column(card.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            "Sign in to sync your todos across devices. Your local list comes with you.",
            fontSize = FontSize.sm,
            color = Palette.muted,
        )
        val pending = auth.pendingEmail
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            if (pending == null) {
                val canSend = email.contains("@") && !auth.busy
                Field(
                    value = email,
                    onValueChange = { email = it },
                    placeholder = "you@example.com",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { if (canSend) viewModel.sendCode(email.trim()) }),
                    modifier = Modifier
                        .weight(1f)
                        .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                        .semantics { contentDescription = "Email" }
                        .testTag(TestIds.authEmail)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s1_5),
                )
                PanelButton("Email me a code", TestIds.authSendCode, filled = true, enabled = canSend) {
                    viewModel.sendCode(email.trim())
                }
            } else {
                val canVerify = code.trim().length == 6 && !auth.busy
                Field(
                    value = code,
                    onValueChange = { code = it.filter(Char::isDigit).take(6) },
                    placeholder = "6-digit code",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { if (canVerify) viewModel.verifyCode(code.trim()) }),
                    modifier = Modifier
                        .weight(1f)
                        .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                        .semantics { contentDescription = "Sign-in code" }
                        .testTag(TestIds.authCode)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s1_5),
                )
                PanelButton("Verify", TestIds.authVerify, filled = true, enabled = canVerify) {
                    viewModel.verifyCode(code.trim())
                    code = ""
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PanelButton("Continue with Google", TestIds.authGoogle, enabled = !auth.busy, modifier = Modifier.weight(1f)) {
                viewModel.providerUrl("google")?.let(uriHandler::openUri)
            }
            PanelButton("Continue with Apple", TestIds.authApple, enabled = !auth.busy, modifier = Modifier.weight(1f)) {
                viewModel.providerUrl("apple")?.let(uriHandler::openUri)
            }
        }
        auth.status?.let { status ->
            Text(
                status,
                fontSize = FontSize.sm,
                color = Palette.muted,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag(TestIds.authStatus),
            )
        }
        if (pending != null) {
            Text(
                "Use a different email",
                fontSize = FontSize.xs,
                color = Palette.muted,
                textDecoration = TextDecoration.Underline,
                modifier = Modifier.clickable(role = Role.Button, onClick = viewModel::changeEmail),
            )
        }
    }
}

@Composable
private fun PanelButton(
    text: String,
    testTag: String,
    filled: Boolean = false,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radius.md)
    Text(
        text,
        fontSize = FontSize.sm,
        fontWeight = if (filled) FontWeight.Medium else FontWeight.Normal,
        color = if (filled) Palette.card else Palette.foreground,
        textAlign = TextAlign.Center,
        modifier = modifier
            .alpha(if (enabled) 1f else 0.4f)
            .clip(shape)
            .then(if (filled) Modifier.background(Palette.foreground) else Modifier.border(1.dp, Palette.border, shape))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .testTag(testTag)
            .padding(horizontal = Spacing.s3, vertical = Spacing.s1_5),
    )
}
