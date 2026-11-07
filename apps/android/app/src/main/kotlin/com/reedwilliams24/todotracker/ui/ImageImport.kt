package com.reedwilliams24.todotracker.ui

import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.reedwilliams24.todotracker.core.TestIds
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.data.ImageImportResult
import com.reedwilliams24.todotracker.data.importTodosFromImage
import kotlinx.coroutines.launch

private sealed interface ImageStatus {
    data object Reading : ImageStatus

    data class Added(val ids: List<String>, val first: String) : ImageStatus

    data object Empty : ImageStatus

    data class Failed(val key: String) : ImageStatus
}

/** Paste or pick an image and add the todos AI finds in it (spec/features/image-import.md). */
@Composable
internal fun ImageImport(
    t: Translator,
    enabled: Boolean,
    onAddMany: (List<TodoDraft>) -> List<Todo>,
    onUndo: (List<String>) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<ImageStatus?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    val busy = status == ImageStatus.Reading

    fun import(uri: Uri) {
        if (!enabled || busy) return
        status = ImageStatus.Reading
        scope.launch {
            status =
                when (val result = importTodosFromImage(context, uri)) {
                    is ImageImportResult.Failed -> ImageStatus.Failed(result.error.key)
                    is ImageImportResult.Drafts ->
                        if (result.todos.isEmpty()) ImageStatus.Empty
                        else
                            onAddMany(result.todos).let { added ->
                                ImageStatus.Added(added.map { it.id }, added[0].title)
                            }
                }
        }
    }

    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> uri?.let(::import) }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            Box {
                Box(
                    Modifier.size(44.dp)
                        .clip(CircleShape)
                        .background(Palette.soft)
                        .alpha(if (enabled && !busy) 1f else 0.4f)
                        .clickable(enabled = enabled && !busy, role = Role.Button) { menuOpen = true }
                        .semantics { contentDescription = t("image.import") }
                        .testTag(TestIds.imageImportButton),
                    contentAlignment = Alignment.Center,
                ) {
                    ImageGlyph()
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text(t("image.paste")) },
                        modifier = Modifier.testTag(TestIds.imageImportPaste),
                        onClick = {
                            menuOpen = false
                            val uri = clipboardImage(context)
                            if (uri == null) status = ImageStatus.Failed("noImage") else import(uri)
                        },
                    )
                    DropdownMenuItem(
                        text = { Text(t("image.choose")) },
                        modifier = Modifier.testTag(TestIds.imageImportChoose),
                        onClick = {
                            menuOpen = false
                            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                    )
                }
            }
            Text(t("image.hint"), fontSize = FontSize.sm, color = Palette.muted)
        }
        status?.let { current ->
            Row(
                Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag(TestIds.imageImportStatus),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    when (current) {
                        ImageStatus.Reading -> t("image.reading")
                        is ImageStatus.Added -> t("image.added", "count" to current.ids.size, "first" to current.first)
                        ImageStatus.Empty -> t("image.empty")
                        is ImageStatus.Failed -> t("image.error.${current.key}")
                    },
                    fontSize = FontSize.sm,
                    color = if (current is ImageStatus.Failed) Palette.danger else Palette.muted,
                )
                if (current is ImageStatus.Added) {
                    Text(
                        t("image.undo"),
                        fontSize = FontSize.sm,
                        fontWeight = FontWeight.SemiBold,
                        color = Palette.foreground,
                        textDecoration = TextDecoration.Underline,
                        modifier =
                            Modifier.clickable(enabled = enabled, role = Role.Button) {
                                    onUndo(current.ids)
                                    status = null
                                }
                                .testTag(TestIds.imageImportUndo)
                                .padding(Spacing.s1),
                    )
                }
            }
        }
    }
}

/** First image `content://` URI on the clipboard, if any. */
private fun clipboardImage(context: Context): Uri? {
    val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return null
    val clip = clipboard.primaryClip ?: return null
    val resolver = context.contentResolver
    return (0 until clip.itemCount)
        .mapNotNull { clip.getItemAt(it).uri }
        .firstOrNull { resolver.getType(it)?.startsWith("image/") == true }
}

@Composable
private fun ImageGlyph() {
    val color = Palette.accent
    Box(Modifier.size(20.dp).border(2.dp, color, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(color))
    }
}
