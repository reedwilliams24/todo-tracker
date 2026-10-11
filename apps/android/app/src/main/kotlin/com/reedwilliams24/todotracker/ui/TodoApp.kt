package com.reedwilliams24.todotracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reedwilliams24.todotracker.TodoViewModel
import com.reedwilliams24.todotracker.core.EMPTY_TODO_FORM
import com.reedwilliams24.todotracker.core.RECURRENCES
import com.reedwilliams24.todotracker.core.Recurrence
import com.reedwilliams24.todotracker.core.STATS_DAYS
import com.reedwilliams24.todotracker.core.THEME_PREFERENCES
import com.reedwilliams24.todotracker.core.TestIds
import com.reedwilliams24.todotracker.core.ThemePreference
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.TodoFilter
import com.reedwilliams24.todotracker.core.TodoPriority
import com.reedwilliams24.todotracker.core.TodoSort
import com.reedwilliams24.todotracker.core.computeStats
import com.reedwilliams24.todotracker.core.countCompleted
import com.reedwilliams24.todotracker.core.countRemaining
import com.reedwilliams24.todotracker.core.filterTodos
import com.reedwilliams24.todotracker.core.hasQuickAddMeta
import com.reedwilliams24.todotracker.core.isOverdue
import com.reedwilliams24.todotracker.core.isValidDueDate
import com.reedwilliams24.todotracker.core.isValidTitle
import com.reedwilliams24.todotracker.core.parseQuickAdd
import com.reedwilliams24.todotracker.core.quickAddToDraft
import com.reedwilliams24.todotracker.core.remainingLabel
import com.reedwilliams24.todotracker.core.sortTodos
import java.time.Instant

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun TodoApp(viewModel: TodoViewModel) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val theme by viewModel.theme.collectAsStateWithLifecycle()
    var filter by rememberSaveable { mutableStateOf(TodoFilter.ALL) }
    var sort by rememberSaveable { mutableStateOf(TodoSort.PRIORITY) }
    val todos = ui.state.todos
    val visible = remember(todos, filter, sort) { sortTodos(filterTodos(todos, filter), sort) }
    val remaining = countRemaining(todos)
    val completedCount = countCompleted(todos)
    var selecting by rememberSaveable { mutableStateOf(false) }
    var selectedIds by remember { mutableStateOf(emptySet<String>()) }
    var confirmingDelete by remember { mutableStateOf(false) }
    val selected = visible.filter { it.id in selectedIds }.map { it.id }
    val allVisibleSelected = visible.isNotEmpty() && selected.size == visible.size

    fun exitSelectMode() {
        selecting = false
        selectedIds = emptySet()
        confirmingDelete = false
    }

    Box(
        Modifier.fillMaxSize()
            .background(Palette.background)
            .semantics { testTagsAsResourceId = true }
            .safeDrawingPadding()
    ) {
        Column(
            Modifier.align(Alignment.TopCenter).widthIn(max = 640.dp).fillMaxSize().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
                verticalAlignment = Alignment.Top,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        "Todo Tracker",
                        fontSize = FontSize.xl2,
                        fontWeight = FontWeight.SemiBold,
                        color = Palette.foreground,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text("A tiny local-first todo list.", fontSize = FontSize.sm, color = Palette.muted)
                }
                ThemeToggle(theme, onSelect = viewModel::setTheme)
            }

            TodoForm(onAdd = viewModel::add)

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    Modifier.selectableGroup().semantics { contentDescription = "Filter todos" },
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    TodoFilter.entries.forEach { option ->
                        val selected = filter == option
                        Text(
                            option.key.replaceFirstChar(Char::uppercase),
                            fontSize = FontSize.sm,
                            color = if (selected) Palette.card else Palette.foreground.copy(alpha = 0.7f),
                            modifier =
                                Modifier.clip(CircleShape)
                                    .background(if (selected) Palette.foreground else Palette.background)
                                    .selectable(selected = selected, role = Role.Tab) { filter = option }
                                    .testTag(TestIds.filter(option.key))
                                    .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    if (todos.isNotEmpty()) {
                        LinkText(if (selecting) "Done" else "Select", TestIds.selectMode) {
                            if (selecting) exitSelectMode() else selecting = true
                        }
                    }
                    if (completedCount > 0 && !selecting) {
                        LinkText(
                            "Clear completed ($completedCount)",
                            TestIds.clearCompleted,
                            onClick = viewModel::clearCompleted,
                        )
                    }
                }
            }

            Row(
                Modifier.selectableGroup().semantics { contentDescription = "Sort todos" }.testTag(TestIds.sort),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Sort",
                    fontSize = FontSize.sm,
                    color = Palette.muted,
                    modifier = Modifier.padding(end = Spacing.s1),
                )
                TodoSort.entries.forEach { option ->
                    val selected = sort == option
                    Text(
                        if (option == TodoSort.DUE) "Due date" else "Priority",
                        fontSize = FontSize.sm,
                        color = if (selected) Palette.card else Palette.foreground.copy(alpha = 0.7f),
                        modifier =
                            Modifier.clip(CircleShape)
                                .background(if (selected) Palette.foreground else Palette.background)
                                .selectable(selected = selected, role = Role.Tab) { sort = option }
                                .testTag(TestIds.sortOption(option.key))
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
                    )
                }
            }

            if (selecting) {
                BulkBar(
                    count = selected.size,
                    allSelected = allVisibleSelected,
                    confirmingDelete = confirmingDelete,
                    onSelectAll = {
                        selectedIds = if (allVisibleSelected) emptySet() else visible.map { it.id }.toSet()
                    },
                    onToggle = {
                        viewModel.toggleMany(selected)
                        exitSelectMode()
                    },
                    onDelete = { confirmingDelete = true },
                    onConfirmDelete = {
                        viewModel.removeMany(selected)
                        exitSelectMode()
                    },
                    onCancelDelete = { confirmingDelete = false },
                )
            }

            Box(Modifier.weight(1f)) {
                when {
                    !ui.hydrated -> EmptyText("Loading…", Modifier)
                    visible.isEmpty() ->
                        EmptyText(
                            if (todos.isEmpty()) "No todos yet. Add your first one above."
                            else "No ${filter.key} todos.",
                            Modifier.testTag(TestIds.empty),
                        )
                    else ->
                        LazyColumn(
                            Modifier.fillMaxSize().testTag(TestIds.list),
                            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                        ) {
                            items(visible, key = { it.id }) { todo ->
                                TodoItem(
                                    todo,
                                    onToggle = viewModel::toggle,
                                    onRename = viewModel::rename,
                                    onRemove = viewModel::remove,
                                    selection =
                                        if (selecting) {
                                            Selection(todo.id in selectedIds) { id ->
                                                selectedIds =
                                                    if (id in selectedIds) selectedIds - id else selectedIds + id
                                            }
                                        } else {
                                            null
                                        },
                                )
                            }
                        }
                }
            }

            Text(
                remainingLabel(remaining),
                fontSize = FontSize.xs,
                color = Palette.muted,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag(TestIds.remaining),
            )

            if (ui.hydrated) StatsPanel(todos)
        }

        ui.state.undoable?.let { entry ->
            Row(
                Modifier.align(Alignment.BottomCenter)
                    .imePadding()
                    .padding(bottom = 24.dp)
                    .clip(RoundedCornerShape(Radius.lg))
                    .background(Palette.foreground)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .testTag(TestIds.undoToast)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    entry.label,
                    fontSize = FontSize.sm,
                    color = Palette.card,
                    modifier = Modifier.testTag(TestIds.undoLabel),
                )
                Text(
                    "Undo",
                    fontSize = FontSize.sm,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.card,
                    textDecoration = TextDecoration.Underline,
                    modifier =
                        Modifier.clickable(role = Role.Button, onClick = viewModel::undo)
                            .testTag(TestIds.undoAction)
                            .padding(Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun LinkText(label: String, tag: String, onClick: () -> Unit) {
    Text(
        label,
        fontSize = FontSize.sm,
        color = Palette.foreground.copy(alpha = 0.7f),
        modifier = Modifier.clickable(role = Role.Button, onClick = onClick).testTag(tag),
    )
}

@Composable
private fun ActionButton(
    label: String,
    tag: String,
    enabled: Boolean = true,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    Text(
        label,
        fontSize = FontSize.sm,
        fontWeight = FontWeight.Medium,
        color = if (danger) Palette.card else Palette.foreground,
        modifier =
            Modifier.alpha(if (enabled) 1f else 0.4f)
                .clip(RoundedCornerShape(Radius.md))
                .background(if (danger) Palette.danger else Palette.card)
                .border(1.dp, if (danger) Palette.danger else Palette.border, RoundedCornerShape(Radius.md))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .testTag(tag)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
    )
}

@Composable
private fun BulkBar(
    count: Int,
    allSelected: Boolean,
    confirmingDelete: Boolean,
    onSelectAll: () -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onConfirmDelete: () -> Unit,
    onCancelDelete: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .semantics { contentDescription = "Bulk actions" }
            .testTag(TestIds.bulkBar)
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (confirmingDelete) {
            Text(
                "Delete $count ${if (count == 1) "todo" else "todos"}?",
                fontSize = FontSize.sm,
                fontWeight = FontWeight.Medium,
                color = Palette.foreground,
                modifier = Modifier.weight(1f),
            )
            ActionButton("Cancel", TestIds.bulkDeleteCancel, onClick = onCancelDelete)
            ActionButton("Delete", TestIds.bulkDeleteConfirm, danger = true, onClick = onConfirmDelete)
        } else {
            Text(
                "$count selected",
                fontSize = FontSize.sm,
                color = Palette.muted,
                modifier = Modifier.testTag(TestIds.selectedCount),
            )
            Text(
                if (allSelected) "Select none" else "Select all",
                fontSize = FontSize.sm,
                color = Palette.foreground,
                modifier =
                    Modifier.weight(1f).clickable(role = Role.Button, onClick = onSelectAll).testTag(TestIds.selectAll),
            )
            ActionButton("Toggle complete", TestIds.bulkToggle, enabled = count > 0, onClick = onToggle)
            ActionButton("Delete", TestIds.bulkDelete, enabled = count > 0, danger = true, onClick = onDelete)
        }
    }
}

private data class Selection(val selected: Boolean, val onSelect: (String) -> Unit)

@Composable
private fun SelectableItem(todo: Todo, selection: Selection) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(
                if (selection.selected) 1.5.dp else 1.dp,
                if (selection.selected) Palette.foreground else Palette.border,
                RoundedCornerShape(Radius.lg),
            )
            .background(Palette.card)
            .toggleable(value = selection.selected, role = Role.Checkbox) { selection.onSelect(todo.id) }
            .testTag(TestIds.item(todo.title))
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2_5),
    ) {
        Box(
            Modifier.size(Spacing.s5)
                .clip(CircleShape)
                .border(1.5.dp, Palette.foreground, CircleShape)
                .background(if (selection.selected) Palette.foreground else Palette.card)
                .semantics { contentDescription = "Select \"${todo.title}\"" }
                .testTag(TestIds.itemSelect(todo.title)),
            contentAlignment = Alignment.Center,
        ) {
            if (selection.selected) Text("✓", color = Palette.card, fontSize = FontSize.xs)
        }
        Text(
            todo.title,
            fontSize = FontSize.base,
            color = Palette.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textDecoration = if (todo.completed) TextDecoration.LineThrough else null,
            modifier = Modifier.weight(1f).alpha(if (todo.completed) 0.5f else 1f),
        )
        val (badgeBg, badgeText) = Palette.priority(todo.priority)
        Text(
            todo.priority.key.replaceFirstChar(Char::uppercase),
            fontSize = FontSize.xs,
            color = badgeText,
            modifier =
                Modifier.clip(CircleShape).background(badgeBg).padding(horizontal = Spacing.s2, vertical = Spacing.s0_5),
        )
    }
}

@Composable
private fun StatsPanel(todos: List<Todo>) {
    var open by rememberSaveable { mutableStateOf(false) }
    val stats = remember(todos) { computeStats(todos, Instant.now()) }
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
    ) {
        Row(
            Modifier.fillMaxWidth()
                .clickable(role = Role.Button, onClickLabel = if (open) "Hide stats" else "Show stats") { open = !open }
                .testTag(TestIds.statsToggle)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Stats", fontSize = FontSize.sm, fontWeight = FontWeight.Medium, color = Palette.foreground)
            Text(if (open) "Hide" else "Show", fontSize = FontSize.xs, color = Palette.muted)
        }
        if (open) {
            Column(
                Modifier.padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Row(Modifier.fillMaxWidth()) {
                    StatValue("Completed", stats.totalCompleted.toString(), TestIds.statsTotal, Modifier.weight(1f))
                    StatValue("Current streak", "${stats.currentStreak}d", TestIds.statsCurrent, Modifier.weight(1f))
                    StatValue("Longest streak", "${stats.longestStreak}d", TestIds.statsLongest, Modifier.weight(1f))
                }
                val max = maxOf(1, stats.perDay.maxOf { it.count })
                Row(
                    Modifier.fillMaxWidth()
                        .height(64.dp)
                        .semantics { contentDescription = "Completed per day, last $STATS_DAYS days" }
                        .testTag(TestIds.statsChart),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    stats.perDay.forEach { day ->
                        Box(
                            Modifier.weight(1f)
                                .fillMaxHeight(if (day.count == 0) 0.04f else day.count.toFloat() / max)
                                .clip(RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp))
                                .background(if (day.count == 0) Palette.border else Palette.foreground)
                                .semantics { contentDescription = "${day.date}: ${day.count} completed" }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatValue(label: String, value: String, testId: String, modifier: Modifier) {
    Column(modifier) {
        Text(label, fontSize = FontSize.xs, color = Palette.muted)
        Text(
            value,
            fontSize = FontSize.lg,
            fontWeight = FontWeight.SemiBold,
            color = Palette.foreground,
            modifier = Modifier.testTag(testId),
        )
    }
}

@Composable
private fun ThemeToggle(preference: ThemePreference, onSelect: (ThemePreference) -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(Radius.md))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
            .selectableGroup()
            .semantics { contentDescription = "Theme" }
            .testTag(TestIds.themeToggle)
    ) {
        THEME_PREFERENCES.forEach { option ->
            val selected = option == preference
            Text(
                option.label,
                fontSize = FontSize.xs,
                color = if (selected) Palette.card else Palette.foreground.copy(alpha = 0.7f),
                modifier =
                    Modifier.background(if (selected) Palette.foreground else Color.Transparent)
                        .selectable(selected = selected, role = Role.Tab) { onSelect(option) }
                        .testTag(TestIds.themeOption(option.key))
                        .padding(horizontal = Spacing.s2_5, vertical = Spacing.s1),
            )
        }
    }
}

@Composable
private fun EmptyText(text: String, modifier: Modifier) {
    Text(
        text,
        fontSize = FontSize.sm,
        color = Palette.muted,
        textAlign = TextAlign.Center,
        modifier = modifier.fillMaxWidth().padding(vertical = Spacing.s10),
    )
}

@Composable private fun inputStyle() = TextStyle(fontSize = FontSize.base, color = Palette.foreground)

@Composable
private fun Field(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    style: TextStyle = inputStyle(),
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = style,
        cursorBrush = SolidColor(Palette.foreground),
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        modifier = modifier,
        decorationBox = { inner ->
            Box {
                if (value.isEmpty()) Text(placeholder, style = style.copy(color = Palette.muted))
                inner()
            }
        },
    )
}

@Composable
private fun Field(
    value: TextFieldValue,
    onValueChange: (TextFieldValue) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    style: TextStyle = inputStyle(),
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = style,
        cursorBrush = SolidColor(Palette.foreground),
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        modifier = modifier,
        decorationBox = { inner ->
            Box {
                if (value.text.isEmpty()) Text(placeholder, style = style.copy(color = Palette.muted))
                inner()
            }
        },
    )
}

@Composable
private fun TodoForm(onAdd: (TodoDraft) -> Unit) {
    var title by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.title) }
    var priority by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.priority) }
    var dueDate by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.dueDate) }
    var recurrence by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.recurrence) }
    val parsed = remember(title) { parseQuickAdd(title) }
    val dateOk = isValidDueDate(dueDate)
    val canAdd = isValidTitle(parsed.title) && dateOk

    fun submit() {
        if (!canAdd) return
        onAdd(quickAddToDraft(parsed, priority, dueDate).copy(recurrence = Recurrence.fromKey(recurrence)))
        title = EMPTY_TODO_FORM.title
        priority = EMPTY_TODO_FORM.priority
        dueDate = EMPTY_TODO_FORM.dueDate
        recurrence = EMPTY_TODO_FORM.recurrence
    }

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Field(
            value = title,
            onValueChange = { title = it },
            placeholder = "What needs doing? e.g. tomorrow !p1 #tag",
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            modifier =
                Modifier.fillMaxWidth()
                    .semantics { contentDescription = "Todo title" }
                    .testTag(TestIds.formTitle)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(
                Modifier.clip(RoundedCornerShape(Radius.md))
                    .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                    .selectableGroup()
                    .semantics { contentDescription = "Priority" }
                    .testTag(TestIds.formPriority)
            ) {
                listOf(TodoPriority.LOW, TodoPriority.MEDIUM, TodoPriority.HIGH).forEach { option ->
                    val selected = option == priority
                    Text(
                        option.key.replaceFirstChar(Char::uppercase),
                        fontSize = FontSize.sm,
                        color = if (selected) Palette.card else Palette.foreground,
                        modifier =
                            Modifier.background(if (selected) Palette.foreground else Palette.card)
                                .selectable(selected = selected, role = Role.RadioButton) { priority = option }
                                .testTag(TestIds.formPriorityOption(option.key))
                                .padding(horizontal = Spacing.s2_5, vertical = Spacing.s1_5),
                    )
                }
            }
            Field(
                value = dueDate,
                onValueChange = { dueDate = it },
                placeholder = "YYYY-MM-DD",
                style = inputStyle().copy(fontSize = FontSize.sm),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                modifier =
                    Modifier.weight(1f)
                        .border(1.dp, if (dateOk) Palette.border else Palette.danger, RoundedCornerShape(Radius.md))
                        .semantics { contentDescription = "Due date" }
                        .testTag(TestIds.formDueDate)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1_5),
            )
        }
        Row(
            Modifier.clip(RoundedCornerShape(Radius.md))
                .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                .selectableGroup()
                .semantics { contentDescription = "Repeat" }
                .testTag(TestIds.formRecurrence)
        ) {
            (listOf("" to "No repeat") + RECURRENCES.map { it.key to it.label }).forEach { (key, label) ->
                val selected = key == recurrence
                Text(
                    label,
                    fontSize = FontSize.sm,
                    color = if (selected) Palette.card else Palette.foreground,
                    modifier =
                        Modifier.background(if (selected) Palette.foreground else Palette.card)
                            .selectable(selected = selected, role = Role.RadioButton) { recurrence = key }
                            .testTag(TestIds.formRecurrenceOption(key.ifEmpty { "none" }))
                            .padding(horizontal = Spacing.s2_5, vertical = Spacing.s1_5),
                )
            }
        }
        if (hasQuickAddMeta(parsed)) {
            Column(
                Modifier.testTag(TestIds.quickAddPreview).padding(horizontal = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s0_5),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text("Will add:", fontSize = FontSize.xs, color = Palette.muted)
                    Text(
                        parsed.title.ifEmpty { "…" },
                        fontSize = FontSize.xs,
                        fontWeight = FontWeight.Medium,
                        color = Palette.foreground,
                        modifier = Modifier.testTag(TestIds.quickAddPreviewTitle),
                    )
                }
                val meta =
                    listOfNotNull(
                        parsed.dueDate?.let { "Due $it" },
                        parsed.priority?.let { "${it.key.replaceFirstChar(Char::uppercase)} priority" },
                    ) + parsed.tags.map { "#$it" }
                if (meta.isNotEmpty()) Text(meta.joinToString("  ·  "), fontSize = FontSize.xs, color = Palette.muted)
            }
        }
        Text(
            "Add",
            fontSize = FontSize.sm,
            fontWeight = FontWeight.Medium,
            color = Palette.card,
            modifier =
                Modifier.align(Alignment.End)
                    .alpha(if (canAdd) 1f else 0.4f)
                    .clip(RoundedCornerShape(Radius.md))
                    .background(Palette.foreground)
                    .clickable(enabled = canAdd, role = Role.Button) { submit() }
                    .semantics { contentDescription = "Add todo" }
                    .testTag(TestIds.formSubmit)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        )
    }
}

@Composable
private fun TodoItem(
    todo: Todo,
    onToggle: (String) -> Unit,
    onRename: (String, String) -> Unit,
    onRemove: (String) -> Unit,
    selection: Selection? = null,
) {
    if (selection != null) {
        SelectableItem(todo, selection)
        return
    }
    var editing by remember { mutableStateOf(false) }
    // onFocusChanged reports "unfocused" when the editor first attaches; only a real blur commits.
    var editorFocused by remember { mutableStateOf(false) }
    var draft by remember(todo.title) { mutableStateOf(TextFieldValue(todo.title, TextRange(todo.title.length))) }
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val overdue = isOverdue(todo)

    fun commit() {
        if (!editing) return
        val title = draft.text
        if (isValidTitle(title) && title.trim() != todo.title) {
            onRename(todo.id, title)
        } else {
            draft = TextFieldValue(todo.title, TextRange(todo.title.length))
        }
        editing = false
        editorFocused = false
    }

    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, if (overdue) Palette.danger else Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .testTag(TestIds.item(todo.title))
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2_5),
    ) {
        Box(
            Modifier.size(Spacing.s5)
                .clip(RoundedCornerShape(Radius.sm))
                .border(1.5.dp, Palette.foreground, RoundedCornerShape(Radius.sm))
                .background(if (todo.completed) Palette.foreground else Palette.card)
                .toggleable(value = todo.completed, role = Role.Checkbox) { onToggle(todo.id) }
                .semantics {
                    contentDescription = "Mark \"${todo.title}\" as ${if (todo.completed) "active" else "complete"}"
                }
                .testTag(TestIds.itemToggle(todo.title)),
            contentAlignment = Alignment.Center,
        ) {
            if (todo.completed) Text("✓", color = Palette.card, fontSize = FontSize.xs)
        }

        if (editing) {
            LaunchedEffect(Unit) { focus.requestFocus() }
            Field(
                value = draft,
                onValueChange = { draft = it },
                placeholder = "",
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                modifier =
                    Modifier.weight(1f)
                        .focusRequester(focus)
                        .onFocusChanged { if (it.isFocused) editorFocused = true else if (editorFocused) commit() }
                        .onPreviewKeyEvent { event ->
                            if (event.key == Key.Enter) {
                                focusManager.clearFocus()
                                true
                            } else {
                                false
                            }
                        }
                        .semantics { contentDescription = "Edit title" }
                        .testTag(TestIds.itemEditInput)
                        .padding(vertical = Spacing.s1),
            )
        } else {
            Text(
                todo.title,
                fontSize = FontSize.base,
                color = Palette.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (todo.completed) TextDecoration.LineThrough else null,
                modifier =
                    Modifier.weight(1f)
                        .alpha(if (todo.completed) 0.7f else 1f)
                        .clickable(role = Role.Button, onClickLabel = "open the title for editing") { editing = true }
                        .semantics { contentDescription = "Edit \"${todo.title}\"" }
                        .testTag(TestIds.itemTitle(todo.title)),
            )
        }

        todo.dueDate?.let {
            val color = if (overdue) Palette.danger else Palette.muted
            Row(
                Modifier.semantics(mergeDescendants = true) {
                    contentDescription = if (overdue) "Overdue, was due $it" else "Due $it"
                },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (overdue) {
                    Text(
                        "Overdue · ",
                        fontSize = FontSize.xs,
                        fontWeight = FontWeight.Medium,
                        color = color,
                        modifier = Modifier.testTag(TestIds.itemOverdue(todo.title)),
                    )
                }
                Text(
                    it,
                    fontSize = FontSize.xs,
                    color = color,
                    modifier = Modifier.testTag(TestIds.itemDueDate(todo.title)),
                )
            }
        }

        todo.recurrence?.let {
            Text(
                "↻ ${it.label}",
                fontSize = FontSize.xs,
                color = Palette.muted,
                modifier = Modifier.testTag(TestIds.itemRecurrence(todo.title)),
            )
        }

        val (badgeBg, badgeText) = Palette.priority(todo.priority)
        Text(
            todo.priority.key.replaceFirstChar(Char::uppercase),
            fontSize = FontSize.xs,
            color = badgeText,
            modifier =
                Modifier.clip(CircleShape)
                    .background(badgeBg)
                    .testTag(TestIds.itemPriority(todo.title))
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s0_5),
        )

        Text(
            "×",
            fontSize = FontSize.lg,
            color = Palette.muted,
            modifier =
                Modifier.clickable(role = Role.Button) { onRemove(todo.id) }
                    .semantics { contentDescription = "Delete \"${todo.title}\"" }
                    .testTag(TestIds.itemDelete(todo.title))
                    .padding(horizontal = Spacing.s1_5, vertical = Spacing.s0_5),
        )
    }
}
