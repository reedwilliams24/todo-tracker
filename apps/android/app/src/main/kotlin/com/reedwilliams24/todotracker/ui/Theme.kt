package com.reedwilliams24.todotracker.ui

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reedwilliams24.todotracker.core.TodoPriority

/**
 * Daybook tokens (spec/features/daybook.md); light/dark values match the web `.d-day` palette. Text meets WCAG AA
 * (spec/features/accessibility.md).
 */
@Immutable
data class Colors(
    val background: Color,
    val card: Color,
    val border: Color,
    val foreground: Color,
    val muted: Color,
    val accent: Color,
    val accentInk: Color,
    val soft: Color,
    val danger: Color,
    val high: Color,
    val medium: Color,
    val low: Color,
    val note: Color,
    val noteBackground: Color,
)

val LightColors =
    Colors(
        background = Color(0xFFF3F4FA),
        card = Color(0xFFFFFFFF),
        border = Color(0xFFE3E5F1),
        foreground = Color(0xFF151833),
        muted = Color(0xFF686D8E),
        accent = Color(0xFF4F46E5),
        accentInk = Color(0xFFFFFFFF),
        soft = Color(0xFFECEDFF),
        danger = Color(0xFFE5484D),
        high = Color(0xFFE5484D),
        medium = Color(0xFFE58A00),
        low = Color(0xFF0E9F6E),
        note = Color(0xFF8A5300),
        noteBackground = Color(0xFFFFF4E0),
    )

val DarkColors =
    Colors(
        background = Color(0xFF0D0F21),
        card = Color(0xFF171A33),
        border = Color(0xFF272B4D),
        foreground = Color(0xFFE8EAFB),
        muted = Color(0xFF9196BA),
        accent = Color(0xFF8B8DFF),
        accentInk = Color(0xFF0D0F21),
        soft = Color(0xFF23274F),
        danger = Color(0xFFFF6B6E),
        high = Color(0xFFFF6B6E),
        medium = Color(0xFFFBBF24),
        low = Color(0xFF34D399),
        note = Color(0xFFF5C26B),
        noteBackground = Color(0xFF2C2414),
    )

private fun Colors.materialScheme(dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = accent,
        onPrimary = accentInk,
        primaryContainer = soft,
        onPrimaryContainer = accent,
        secondaryContainer = soft,
        onSecondaryContainer = accent,
        background = background,
        onBackground = foreground,
        surface = card,
        onSurface = foreground,
        surfaceContainer = card,
        onSurfaceVariant = muted,
        outline = border,
        outlineVariant = border,
        error = danger,
    )
}

val LocalColors = staticCompositionLocalOf { LightColors }

@Composable
fun TodoTheme(dark: Boolean, content: @Composable () -> Unit) {
    val colors = if (dark) DarkColors else LightColors
    MaterialTheme(colorScheme = colors.materialScheme(dark)) {
        CompositionLocalProvider(LocalColors provides colors, content = content)
    }
}

object Palette {
    val background: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.background

    val card: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.card

    val border: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.border

    val foreground: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.foreground

    val muted: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.muted

    val accent: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.accent

    val accentInk: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.accentInk

    val soft: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.soft

    val danger: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.danger

    val success: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.low

    val note: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.note

    @Composable
    @ReadOnlyComposable
    fun priority(priority: TodoPriority): Color =
        when (priority) {
            TodoPriority.HIGH -> LocalColors.current.high
            TodoPriority.MEDIUM -> LocalColors.current.medium
            TodoPriority.LOW -> LocalColors.current.low
        }
}

object Spacing {
    val s0_5 = 2.dp
    val s1 = 4.dp
    val s1_5 = 6.dp
    val s2 = 8.dp
    val s2_5 = 10.dp
    val s3 = 12.dp
    val s4 = 16.dp
    val s5 = 20.dp
    val s10 = 40.dp
}

object Radius {
    val sm = 4.dp
    val md = 8.dp
    val lg = 14.dp
}

object FontSize {
    val xs = 12.sp
    val sm = 14.sp
    val base = 16.sp
    val lg = 18.sp
    val xl2 = 24.sp
}
