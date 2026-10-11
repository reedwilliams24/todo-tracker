package com.reedwilliams24.todotracker.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.reedwilliams24.todotracker.core.ExportFormat
import com.reedwilliams24.todotracker.core.ImportMode
import com.reedwilliams24.todotracker.core.ImportResult
import com.reedwilliams24.todotracker.core.TestIds
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.describeImport
import com.reedwilliams24.todotracker.core.describeImported
import com.reedwilliams24.todotracker.core.exportFileName
import com.reedwilliams24.todotracker.core.exportTodosCsv
import com.reedwilliams24.todotracker.core.exportTodosJson
import com.reedwilliams24.todotracker.core.parseImportJson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Some file providers report .json files as text/plain or octet-stream.
private val IMPORT_TYPES = arrayOf("application/json", "text/plain", "application/octet-stream")

/** Export JSON/CSV through the system "save as" picker and import JSON with a merge/replace confirmation. */
@Composable
fun TransferBar(todos: List<Todo>, onImport: (List<Todo>, ImportMode) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pending by remember { mutableStateOf<ImportResult?>(null) }
    var status by rememberSaveable { mutableStateOf<String?>(null) }
    var exportBody by remember { mutableStateOf("") }

    fun write(uri: Uri?) {
        if (uri == null) return
        val body = exportBody
        scope.launch(Dispatchers.IO) {
            runCatching { context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(body.toByteArray()) } }
        }
    }
    val exportJson = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(ExportFormat.JSON.mimeType)) { write(it) }
    val exportCsv = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(ExportFormat.CSV.mimeType)) { write(it) }
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            scope.launch {
                val text = withContext(Dispatchers.IO) {
                    runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes().decodeToString() } }.getOrNull()
                }
                pending = parseImportJson(text.orEmpty())
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            LinkButton("Export JSON", TestIds.exportJson, enabled = todos.isNotEmpty()) {
                exportBody = exportTodosJson(todos)
                exportJson.launch(exportFileName(ExportFormat.JSON))
            }
            LinkButton("Export CSV", TestIds.exportCsv, enabled = todos.isNotEmpty()) {
                exportBody = exportTodosCsv(todos)
                exportCsv.launch(exportFileName(ExportFormat.CSV))
            }
            LinkButton("Import JSON…", TestIds.importOpen) {
                status = null
                importer.launch(IMPORT_TYPES)
            }
        }
        status?.let { Text(it, fontSize = FontSize.xs, color = Palette.muted, modifier = Modifier.testTag(TestIds.importStatus)) }
        pending?.let { result ->
            ImportPanel(
                result,
                onConfirm = { mode ->
                    onImport(result.todos, mode)
                    status = describeImported(result.todos.size, mode)
                    pending = null
                },
                onCancel = { pending = null },
            )
        }
    }
}

@Composable
private fun LinkButton(label: String, tag: String, enabled: Boolean = true, onClick: () -> Unit) {
    Text(
        label,
        fontSize = FontSize.xs,
        color = Palette.foreground.copy(alpha = if (enabled) 0.7f else 0.3f),
        modifier = Modifier
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .testTag(tag)
            .padding(vertical = Spacing.s1),
    )
}

@Composable
private fun ImportPanel(result: ImportResult, onConfirm: (ImportMode) -> Unit, onCancel: () -> Unit) {
    val canImport = result.todos.isNotEmpty()
    val shape = RoundedCornerShape(Radius.lg)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.card)
            .border(1.dp, Palette.border, shape)
            .semantics { paneTitle = "Confirm import" }
            .testTag(TestIds.importDialog)
            .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            describeImport(result.todos.size, result.errors.size),
            fontSize = FontSize.xs,
            color = Palette.foreground,
            modifier = Modifier.testTag(TestIds.importSummary),
        )
        if (result.errors.isNotEmpty()) {
            Column(Modifier.heightIn(max = 128.dp).verticalScroll(rememberScrollState())) {
                result.errors.forEach { error ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text("•", fontSize = FontSize.xs, color = Palette.danger)
                        Text(error, fontSize = FontSize.xs, color = Palette.danger, modifier = Modifier.testTag(TestIds.importError))
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Merge",
                fontSize = FontSize.xs,
                color = Palette.card,
                modifier = Modifier
                    .alpha(if (canImport) 1f else 0.3f)
                    .clip(RoundedCornerShape(Radius.md))
                    .background(Palette.foreground)
                    .clickable(enabled = canImport, role = Role.Button) { onConfirm(ImportMode.MERGE) }
                    .testTag(TestIds.importMode(ImportMode.MERGE.key))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
            )
            Text(
                "Replace",
                fontSize = FontSize.xs,
                color = Palette.foreground,
                modifier = Modifier
                    .alpha(if (canImport) 1f else 0.3f)
                    .clip(RoundedCornerShape(Radius.md))
                    .border(1.dp, Palette.foreground.copy(alpha = 0.2f), RoundedCornerShape(Radius.md))
                    .clickable(enabled = canImport, role = Role.Button) { onConfirm(ImportMode.REPLACE) }
                    .testTag(TestIds.importMode(ImportMode.REPLACE.key))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
            )
            LinkButton("Cancel", TestIds.importCancel, onClick = onCancel)
        }
    }
}
