package com.reedwilliams24.todotracker.core

const val THEME_STORAGE_KEY = "todo-tracker:theme:v1"

/** Light/dark/system preference; see spec/features/theme.md. Order is display order. */
enum class ThemePreference(val key: String, val label: String) {
    LIGHT("light", "Light"),
    DARK("dark", "Dark"),
    SYSTEM("system", "System"),
}

enum class ResolvedTheme(val key: String) {
    LIGHT("light"),
    DARK("dark"),
}

val THEME_PREFERENCES: List<ThemePreference> = ThemePreference.entries
val DEFAULT_THEME = ThemePreference.SYSTEM

/** Missing, empty, unknown or differently cased values fall back to the default. */
fun parseThemePreference(raw: String?): ThemePreference =
    ThemePreference.entries.firstOrNull { it.key == raw } ?: DEFAULT_THEME

fun resolveTheme(preference: ThemePreference, systemDark: Boolean): ResolvedTheme =
    when (preference) {
        ThemePreference.LIGHT -> ResolvedTheme.LIGHT
        ThemePreference.DARK -> ResolvedTheme.DARK
        ThemePreference.SYSTEM -> if (systemDark) ResolvedTheme.DARK else ResolvedTheme.LIGHT
    }

/** light -> dark -> system -> light */
fun nextThemePreference(preference: ThemePreference): ThemePreference =
    THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.size]
