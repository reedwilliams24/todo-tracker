package com.reedwilliams24.todotracker.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reedwilliams24.todotracker.core.TodoPriority

/** Same tokens as apps/mobile/src/theme.ts (Tailwind scale used by apps/web). */
object Palette {
    val background = Color(0xFFF7F7F5)
    val card = Color.White
    val border = Color(0x1A000000)
    val foreground = Color(0xFF171717)
    val muted = Color(0x99171717)
    val danger = Color(0xFFDC2626)

    fun priority(priority: TodoPriority): Pair<Color, Color> = when (priority) {
        TodoPriority.HIGH -> Color(0x26EF4444) to Color(0xFFDC2626)
        TodoPriority.MEDIUM -> Color(0x26F59E0B) to Color(0xFFD97706)
        TodoPriority.LOW -> Color(0x2610B981) to Color(0xFF059669)
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
