package com.reedwilliams24.todotracker.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.util.Base64
import com.reedwilliams24.todotracker.BuildConfig
import com.reedwilliams24.todotracker.core.IMAGE_IMPORT
import com.reedwilliams24.todotracker.core.ImageImportError
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.checkImageUpload
import com.reedwilliams24.todotracker.core.coerceImageDrafts
import com.reedwilliams24.todotracker.core.imageImportErrorFor
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

sealed interface ImageImportResult {
    data class Drafts(val todos: List<TodoDraft>) : ImageImportResult

    data class Failed(val error: ImageImportError) : ImageImportResult
}

/** Sends an image to `/api/image-todos` (spec/features/image-import.md) and validates the drafts it returns. */
suspend fun importTodosFromImage(context: Context, uri: Uri): ImageImportResult =
    withContext(Dispatchers.IO) {
        val jpeg = runCatching { downscale(context, uri) }.getOrNull()
        if (jpeg == null) {
            val type = context.contentResolver.getType(uri).orEmpty()
            return@withContext ImageImportResult.Failed(
                if (type.startsWith("image/")) ImageImportError.INVALID else ImageImportError.UNSUPPORTED
            )
        }
        when (checkImageUpload("image/jpeg", jpeg.size.toLong())) {
            "tooLarge" -> return@withContext ImageImportResult.Failed(ImageImportError.TOO_LARGE)
            "ok" -> Unit
            else -> return@withContext ImageImportResult.Failed(ImageImportError.INVALID)
        }
        val body =
            buildJsonObject {
                    put("image", Base64.encodeToString(jpeg, Base64.NO_WRAP))
                    put("mimeType", "image/jpeg")
                    put("today", LocalDate.now().toString())
                }
                .toString()
        try {
            val connection = URL("${BuildConfig.API_BASE_URL}/api/image-todos").openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.doOutput = true
            connection.setRequestProperty("content-type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray()) }
            val status = connection.responseCode
            val text =
                (if (status in 200..299) connection.inputStream else connection.errorStream)?.use {
                    it.readBytes().decodeToString()
                }
            val json: JsonElement? = text?.let { runCatching { Json.parseToJsonElement(it) }.getOrNull() }
            if (status in 200..299) ImageImportResult.Drafts(coerceImageDrafts(json))
            else ImageImportResult.Failed(imageImportErrorFor(status, json))
        } catch (_: IOException) {
            ImageImportResult.Failed(ImageImportError.OFFLINE)
        }
    }

/** Scales the longer edge to IMAGE_IMPORT.maxDimension and re-encodes as JPEG. */
private fun downscale(context: Context, uri: Uri): ByteArray {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it, null, bounds) }
    val longest = max(bounds.outWidth, bounds.outHeight)
    require(longest > 0)
    var sample = 1
    while (longest / (sample * 2) >= IMAGE_IMPORT.maxDimension) sample *= 2
    val decoded =
        context.contentResolver.openInputStream(uri)!!.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        }!!
    val scale = minOf(1.0, IMAGE_IMPORT.maxDimension.toDouble() / max(decoded.width, decoded.height))
    val width = max(1, (decoded.width * scale).roundToInt())
    val height = max(1, (decoded.height * scale).roundToInt())
    val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    Canvas(output).apply {
        drawColor(Color.WHITE)
        drawBitmap(Bitmap.createScaledBitmap(decoded, width, height, true), 0f, 0f, null)
    }
    return ByteArrayOutputStream().use {
        output.compress(Bitmap.CompressFormat.JPEG, (IMAGE_IMPORT.jpegQuality * 100).roundToInt(), it)
        it.toByteArray()
    }
}
