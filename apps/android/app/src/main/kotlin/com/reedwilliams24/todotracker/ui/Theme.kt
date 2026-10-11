package com.reedwilliams24.todotracker.ui

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
 * Tailwind scale tokens, matching apps/web; dark values mirror the web `.dark` palette. Text meets WCAG AA
 * (spec/features/accessibility.md).
 */
@Immutable
data class Colors(
    val background: Color,
    val card: Color,
    val border: Color,
    val foreground: Color,
    val danger: Color,
    val high: Color,
    val medium: Color,
    val low: Color,
)

val LightColors =
    Colors(
        background = Color(0xFFF7F7F5),
        card = Color.White,
        border = Color(0x1A000000),
        foreground = Color(0xFF171717),
        danger = Color(0xFFDC2626),
        high = Color(0xFFB91C1C),
        medium = Color(0xFF92400E),
        low = Color(0xFF047857),
    )

val DarkColors =
    Colors(
        background = Color(0xFF0B0C0F),
        card = Color(0xFF17181B),
        border = Color(0x26FFFFFF),
        foreground = Color(0xFFE9EAEE),
        danger = Color(0xFFF87171),
        high = Color(0xFFF87171),
        medium = Color(0xFFFBBF24),
        low = Color(0xFF34D399),
    )

val LocalColors = staticCompositionLocalOf { LightColors }

@Composable
fun TodoTheme(dark: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalColors provides if (dark) DarkColors else LightColors, content = content)
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
        @Composable @ReadOnlyComposable get() = foreground.copy(alpha = 0.7f)

    val danger: Color
        @Composable @ReadOnlyComposable get() = LocalColors.current.danger

    @Composable
    @ReadOnlyComposable
    fun priority(priority: TodoPriority): Pair<Color, Color> =
        when (priority) {
            TodoPriority.HIGH -> Color(0x26EF4444) to LocalColors.current.high
            TodoPriority.MEDIUM -> Color(0x26F59E0B) to LocalColors.current.medium
            TodoPriority.LOW -> Color(0x2610B981) to LocalColors.current.low
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
    val lg = 12.dp
}

object FontSize {
    val xs = 12.sp
    val sm = 14.sp
    val base = 16.sp
    val lg = 18.sp
    val xl2 = 24.sp
}
