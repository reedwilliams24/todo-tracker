package com.reedwilliams24.todotracker.core

import java.text.NumberFormat
import java.util.Locale

/** Localized UI copy (spec/features/localization.md). Only English ships; see Messages.kt. */
const val DEFAULT_LOCALE = "en"

val CATALOGS: Map<String, Map<String, String>> = mapOf(DEFAULT_LOCALE to EN_MESSAGES)

private val SUBTAG_SEPARATOR = Regex("[-_]")
private val PLURAL_START = Regex("""\{(\w+),\s*plural,""")
private val PARAM = Regex("""\{(\w+)\}""")

private fun language(tag: String) = tag.lowercase(Locale.ROOT).split(SUBTAG_SEPARATOR).first()

/** First supported locale for the user's preferred BCP 47 tags; exact match, then language subtag. */
fun resolveLocale(preferred: List<String?>, supported: List<String> = CATALOGS.keys.toList()): String {
    for (tag in preferred) {
        if (tag.isNullOrEmpty()) continue
        val lower = tag.lowercase(Locale.ROOT)
        supported.firstOrNull { it.lowercase(Locale.ROOT) == lower }?.let { return it }
        val lang = language(tag)
        supported.firstOrNull { language(it) == lang }?.let { return it }
    }
    return DEFAULT_LOCALE
}

/** Splits `one {…} other {…}` into selector → branch, honouring nested braces. */
private fun parseBranches(source: String): Map<String, String> {
    val options = LinkedHashMap<String, String>()
    var i = 0
    while (i < source.length) {
        val open = source.indexOf('{', i)
        if (open == -1) break
        val selector = source.substring(i, open).trim()
        var depth = 0
        var close = open
        while (close < source.length) {
            if (source[close] == '{') depth++ else if (source[close] == '}' && --depth == 0) break
            close++
        }
        options.putIfAbsent(selector, source.substring(open + 1, minOf(close, source.length)))
        i = close + 1
    }
    return options
}

/** English plural rules; add CLDR rules here when a second catalog ships. */
private fun pluralCategory(count: Double): String = if (count == 1.0) "one" else "other"

private fun countKey(count: Double): String =
    if (count % 1.0 == 0.0 && !count.isInfinite()) count.toLong().toString() else count.toString()

private fun toCount(raw: Any?): Double = when (raw) {
    null -> 0.0
    is Number -> raw.toDouble()
    else -> raw.toString().trim().let { if (it.isEmpty()) 0.0 else it.toDoubleOrNull() ?: Double.NaN }
}

/** `{name}` interpolation and `{count, plural, =N {…} one {…} other {…}}` selection (`#` = the number). */
fun formatMessage(locale: String, message: String, params: Map<String, Any> = emptyMap()): String {
    var out = message
    while (true) {
        val match = PLURAL_START.find(out) ?: break
        var depth = 0
        var end = -1
        for (i in match.range.first until out.length) {
            if (out[i] == '{') depth++ else if (out[i] == '}' && --depth == 0) { end = i; break }
        }
        if (end == -1) break
        val count = toCount(params[match.groupValues[1]])
        val options = parseBranches(out.substring(match.range.last + 1, end))
        val branch = options["=${countKey(count)}"] ?: options[pluralCategory(count)] ?: options["other"] ?: ""
        val number = NumberFormat.getInstance(Locale.forLanguageTag(locale)).format(count)
        out = out.substring(0, match.range.first) + branch.replace("#", number) + out.substring(end + 1)
    }
    return PARAM.replace(out) { m -> params[m.groupValues[1]]?.let(::paramString) ?: m.value }
}

private fun paramString(value: Any): String = when (value) {
    is Double -> countKey(value)
    is Float -> countKey(value.toDouble())
    else -> value.toString()
}

/** Formats catalog messages for one locale; unsupported locales use English, unknown keys render as the key. */
class Translator(locale: String) {
    val locale: String = if (CATALOGS.containsKey(locale)) locale else DEFAULT_LOCALE
    private val catalog = CATALOGS.getValue(this.locale)

    operator fun invoke(key: String, params: Map<String, Any>): String =
        formatMessage(locale, catalog[key] ?: EN_MESSAGES[key] ?: key, params)

    operator fun invoke(key: String, vararg params: Pair<String, Any>): String = invoke(key, params.toMap())
}
