package com.reedwilliams24.todotracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.AutofillNode
import androidx.compose.ui.autofill.AutofillType
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalAutofill
import androidx.compose.ui.platform.LocalAutofillTree
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.reedwilliams24.todotracker.core.AUTH_CODE_LENGTH
import com.reedwilliams24.todotracker.core.AuthError
import com.reedwilliams24.todotracker.core.AuthState
import com.reedwilliams24.todotracker.core.AuthStatus
import com.reedwilliams24.todotracker.core.AuthStep
import com.reedwilliams24.todotracker.core.TestIds
import com.reedwilliams24.todotracker.core.normalizeCode

/** Callbacks from the auth UI to `AuthViewModel`. */
class AuthActions(
    val open: () -> Unit,
    val cancel: () -> Unit,
    val sendCode: (String) -> Unit,
    val resend: () -> Unit,
    val verify: (String) -> Unit,
    val changeEmail: () -> Unit,
    val resolveGuestTodos: (move: Boolean) -> Unit,
    val signOut: () -> Unit,
    val deleteAccount: (onFailure: (AuthError) -> Unit) -> Unit,
)

/** Guest / expired banner, plus the sign-in sheet and Move/Discard prompt when they're open. */
@Composable
fun AuthBanner(state: AuthState, resendSeconds: Int, actions: AuthActions, moveFailed: Boolean = false) {
    val t = rememberTranslator()
    when (state.status) {
        AuthStatus.SIGNED_OUT -> Banner(t("auth.guest.banner"), TestIds.authGuestBanner, t("auth.signIn"), actions.open)
        AuthStatus.EXPIRED ->
            Banner(t("auth.expired.banner"), TestIds.authExpiredBanner, t("auth.expired.signIn"), actions.open)
        AuthStatus.SIGNED_IN -> Unit
    }
    if (state.step != null) SignInSheet(state, resendSeconds, actions, t)
    state.movePrompt?.let { count -> MovePrompt(count, moveFailed, actions, t) }
}

@Composable
private fun Banner(text: String, tag: String, action: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
            .background(Palette.card, RoundedCornerShape(Radius.md))
            .testTag(tag)
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(text, fontSize = FontSize.sm, color = Palette.muted, modifier = Modifier.weight(1f))
        ActionButton(action, TestIds.authSignIn, onClick = onClick)
    }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun Sheet(tag: String, onDismiss: () -> Unit, content: @Composable () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth()
                .background(Palette.card, RoundedCornerShape(Radius.lg))
                .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
                .semantics { testTagsAsResourceId = true }
                .testTag(tag)
                .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            content()
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun SignInSheet(state: AuthState, resendSeconds: Int, actions: AuthActions, t: Translator) {
    var email by rememberSaveable { mutableStateOf(state.email) }
    var code by rememberSaveable { mutableStateOf("") }
    Sheet(TestIds.authSheet, actions.cancel) {
        Text(t("auth.title"), fontSize = FontSize.lg, fontWeight = FontWeight.SemiBold, color = Palette.foreground)
        if (state.step == AuthStep.EMAIL) {
            Text(t("auth.email.label"), fontSize = FontSize.sm, color = Palette.muted)
            InputBox {
                Field(
                    email,
                    { email = it },
                    t("auth.email.placeholder"),
                    Modifier.fillMaxWidth()
                        .autofill(listOf(AutofillType.EmailAddress)) { email = it }
                        .testTag(TestIds.authEmail),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { actions.sendCode(email) }),
                )
            }
        } else {
            Text(t("auth.codeSent", "email" to state.email), fontSize = FontSize.sm, color = Palette.muted)
            Text(t("auth.code.label"), fontSize = FontSize.sm, color = Palette.muted)
            InputBox {
                Field(
                    code,
                    { code = normalizeCode(it) },
                    "0".repeat(AUTH_CODE_LENGTH),
                    Modifier.fillMaxWidth()
                        .autofill(listOf(AutofillType.SmsOtpCode)) { code = normalizeCode(it) }
                        .testTag(TestIds.authCode),
                    keyboardOptions =
                        KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { actions.verify(code) }),
                )
            }
        }
        state.error?.let {
            Text(
                t("auth.error.${it.key}"),
                fontSize = FontSize.sm,
                color = Palette.danger,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag(TestIds.authError),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (state.step == AuthStep.EMAIL) {
                ActionButton(
                    t(if (state.busy) "auth.sending" else "auth.sendCode"),
                    TestIds.authSendCode,
                    enabled = !state.busy,
                ) {
                    actions.sendCode(email)
                }
            } else {
                ActionButton(
                    t(if (state.busy) "auth.verifying" else "auth.verify"),
                    TestIds.authVerify,
                    enabled = !state.busy,
                ) {
                    actions.verify(code)
                }
                ActionButton(
                    if (resendSeconds > 0) t("auth.resendIn", "seconds" to resendSeconds) else t("auth.resend"),
                    TestIds.authResend,
                    enabled = resendSeconds == 0 && !state.busy,
                    onClick = actions.resend,
                )
            }
            ActionButton(t("auth.cancel"), TestIds.authCancel, onClick = actions.cancel)
        }
        if (state.step == AuthStep.CODE) {
            LinkText(t("auth.changeEmail"), TestIds.authChangeEmail) {
                code = ""
                actions.changeEmail()
            }
        }
    }
}

@Composable
private fun InputBox(content: @Composable () -> Unit) {
    Box(
        Modifier.fillMaxWidth()
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
    ) {
        content()
    }
}

@Composable
private fun MovePrompt(count: Int, failed: Boolean, actions: AuthActions, t: Translator) {
    // Dismissing isn't a choice: the guest list must be moved or discarded before the account list shows.
    Sheet(TestIds.authMovePrompt, onDismiss = {}) {
        Text(t("auth.move.prompt", "count" to count), fontSize = FontSize.base, color = Palette.foreground)
        if (failed) {
            Text(
                t("auth.move.failed"),
                fontSize = FontSize.sm,
                color = Palette.danger,
                modifier = Modifier.testTag(TestIds.authMoveError),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ActionButton(t("auth.move.move"), TestIds.authMoveConfirm) { actions.resolveGuestTodos(true) }
            ActionButton(t("auth.move.discard"), TestIds.authMoveDiscard, danger = true) {
                actions.resolveGuestTodos(false)
            }
        }
    }
}

/** Header button with the signed-in email; opens a menu with Sign out and Delete account. */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun AccountMenu(state: AuthState, actions: AuthActions) {
    if (state.status == AuthStatus.SIGNED_OUT) return
    val t = rememberTranslator()
    var open by remember { mutableStateOf(false) }
    var confirmingDelete by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        ActionButton(state.email.ifEmpty { t("auth.account.label") }, TestIds.authAccount) { open = true }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Column(
                Modifier.semantics { testTagsAsResourceId = true }
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    t("auth.account.signedInAs", "email" to state.email),
                    fontSize = FontSize.sm,
                    color = Palette.muted,
                    modifier = Modifier.testTag(TestIds.authAccountEmail),
                )
                ActionButton(t("auth.signOut"), TestIds.authSignOut) {
                    open = false
                    actions.signOut()
                }
                ActionButton(t("auth.delete.menu"), TestIds.authDeleteAccount) {
                    open = false
                    confirmingDelete = true
                }
            }
        }
    }
    if (confirmingDelete) DeleteAccountDialog(state.email, actions, t) { confirmingDelete = false }
}

@Composable
private fun DeleteAccountDialog(email: String, actions: AuthActions, t: Translator, onDismiss: () -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<AuthError?>(null) }
    Sheet(TestIds.authDeleteDialog, onDismiss = { if (!busy) onDismiss() }) {
        Text(
            t("auth.delete.title"),
            fontSize = FontSize.base,
            fontWeight = FontWeight.SemiBold,
            color = Palette.foreground,
        )
        Text(t("auth.delete.message", "email" to email), fontSize = FontSize.sm, color = Palette.muted)
        error?.let {
            Text(
                t("auth.error.${it.key}"),
                fontSize = FontSize.sm,
                color = Palette.danger,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag(TestIds.authDeleteError),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ActionButton(t("auth.cancel"), TestIds.authDeleteCancel, enabled = !busy, onClick = onDismiss)
            ActionButton(
                t(if (busy) "auth.delete.deleting" else "auth.delete.confirm"),
                TestIds.authDeleteConfirm,
                enabled = !busy,
                danger = true,
            ) {
                busy = true
                error = null
                // On success the menu leaves with the session.
                actions.deleteAccount {
                    busy = false
                    error = it
                }
            }
        }
    }
}

/** Offers the system autofill service (password managers, Google's code autofill) for this field. */
@OptIn(ExperimentalComposeUiApi::class)
private fun Modifier.autofill(types: List<AutofillType>, onFill: (String) -> Unit): Modifier = composed {
    val node = remember { AutofillNode(autofillTypes = types, onFill = onFill) }
    val autofill = LocalAutofill.current
    LocalAutofillTree.current += node
    onGloballyPositioned { node.boundingBox = it.boundsInWindow() }
        .onFocusChanged {
            if (it.isFocused) autofill?.requestAutofillForNode(node) else autofill?.cancelAutofillForNode(node)
        }
}
