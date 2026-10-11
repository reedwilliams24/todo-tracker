package com.reedwilliams24.todotracker.ui

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext

/** A catalog key's string or plurals resource, its format-argument order, and which argument picks the plural. */
internal class Message(val id: Int, val args: List<String> = emptyList(), val plural: String? = null)

/**
 * UI copy by spec/i18n/en.json key, read from res/values/messages.xml (generated) so Android
 * picks the locale and plural form. Unknown keys render as the key.
 */
internal class Translator(private val resources: Resources) {
    operator fun invoke(key: String, params: Map<String, Any>): String {
        val message = MESSAGES[key] ?: return key
        val args: Array<Any> = message.args
            .map { name -> if (name == message.plural) count(params[name]) else params[name]?.toString().orEmpty() }
            .toTypedArray()
        return when {
            message.plural != null -> resources.getQuantityString(message.id, count(params[message.plural]), *args)
            args.isEmpty() -> resources.getString(message.id)
            else -> resources.getString(message.id, *args)
        }
    }

    operator fun invoke(key: String, vararg params: Pair<String, Any>): String = invoke(key, params.toMap())

    private fun count(value: Any?): Int = when (value) {
        is Number -> value.toInt()
        is String -> value.trim().toIntOrNull() ?: 0
        else -> 0
    }
}

/** A [Translator] for the current configuration, so a locale change recomposes with new copy. */
@Composable
internal fun rememberTranslator(): Translator {
    val configuration = LocalConfiguration.current
    val resources = LocalContext.current.resources
    return remember(configuration, resources) { Translator(resources) }
}
