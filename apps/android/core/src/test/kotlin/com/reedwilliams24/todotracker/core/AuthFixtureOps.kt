package com.reedwilliams24.todotracker.core

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put

/** `auth` ops; mirrors packages/spec/src/features/auth.ts. */
internal val authOps: Map<String, Op> =
    mapOf(
        "authConstants" to
            { _: JsonObject ->
                buildJsonObject {
                    put("accountStorageKey", ACCOUNT_STORAGE_KEY)
                    put("codeLength", AUTH_CODE_LENGTH)
                    put("resendMs", AUTH_RESEND_MS)
                }
            },
        "authErrorKind" to
            { g: JsonObject ->
                val code = (g["code"] as? JsonPrimitive)?.takeIf { it.isString }?.content
                JsonPrimitive(authErrorKind((g["status"] as? JsonPrimitive)?.intOrNull, code).key)
            },
        "isValidCode" to { g: JsonObject -> JsonPrimitive(isValidCode(g.str("code"))) },
        "isValidEmail" to { g: JsonObject -> JsonPrimitive(isValidEmail(g.str("email"))) },
        "normalizeCode" to { g: JsonObject -> JsonPrimitive(normalizeCode(g.str("input"))) },
        "reduceAuth" to { g: JsonObject -> encodeAuth(runAuth(g)) },
        "resendSecondsLeft" to
            { g: JsonObject ->
                JsonPrimitive(resendSecondsLeft(runAuth(g), g.getValue("now").jsonPrimitive.long))
            },
    )

private fun runAuth(g: JsonObject): AuthState =
    g.getValue("events").jsonArray.map { decodeAuthEvent(it.jsonObject) }.fold(INITIAL_AUTH_STATE, ::reduceAuth)

private fun decodeAuthEvent(e: JsonObject): AuthEvent =
    when (val type = e.str("type")) {
        "open" -> AuthEvent.Open
        "cancel" -> AuthEvent.Cancel
        "sendCode" -> AuthEvent.SendCode(e.str("email"))
        "codeSent" -> AuthEvent.CodeSent(e.getValue("now").jsonPrimitive.long)
        "verify" -> AuthEvent.Verify(e.str("code"))
        "failed" -> AuthEvent.Failed(AuthError.entries.first { it.key == e.str("error") })
        "changeEmail" -> AuthEvent.ChangeEmail
        "signedIn" -> AuthEvent.SignedIn(e.str("userId"), e.str("email"), e.getValue("guestCount").jsonPrimitive.int)
        "guestResolved" -> AuthEvent.GuestResolved
        "signedOut" -> AuthEvent.SignedOut(e.getValue("initiated").jsonPrimitive.boolean)
        else -> error("unknown auth event $type")
    }

private fun nullable(value: String?): JsonElement = value?.let(::JsonPrimitive) ?: JsonNull

private fun encodeAuth(s: AuthState): JsonElement = buildJsonObject {
    put("status", s.status.key)
    put("step", nullable(s.step?.key))
    put("email", s.email)
    put("userId", nullable(s.userId))
    put("busy", s.busy)
    put("error", nullable(s.error?.key))
    put("resendAt", s.resendAt?.let(::JsonPrimitive) ?: JsonNull)
    put("movePrompt", s.movePrompt?.let(::JsonPrimitive) ?: JsonNull)
}
