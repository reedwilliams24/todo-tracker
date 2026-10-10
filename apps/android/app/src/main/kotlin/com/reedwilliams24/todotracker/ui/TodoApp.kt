package com.reedwilliams24.todotracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reedwilliams24.todotracker.TodoViewModel
import com.reedwilliams24.todotracker.core.EMPTY_TODO_FORM
import com.reedwilliams24.todotracker.core.TestIds
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.TodoFilter
import com.reedwilliams24.todotracker.core.TodoPriority
import com.reedwilliams24.todotracker.core.countRemaining
import com.reedwilliams24.todotracker.core.filterTodos
import com.reedwilliams24.todotracker.core.isValidDueDate
import com.reedwilliams24.todotracker.core.isValidTitle
import com.reedwilliams24.todotracker.core.remainingLabel
import com.reedwilliams24.todotracker.core.sortTodos
import com.reedwilliams24.todotracker.core.toTodoDraft

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun TodoApp(viewModel: TodoViewModel) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    var filter by rememberSaveable { mutableStateOf(TodoFilter.ALL) }
    val todos = ui.state.todos
    val visible = remember(todos, filter) { sortTodos(filterTodos(todos, filter)) }
    val remaining = countRemaining(todos)

    Box(
        Modifier
            .fillMaxSize()
            .background(Palette.background)
            .semantics { testTagsAsResourceId = true }
            .safeDrawingPadding(),
    ) {
        Column(
            Modifier
                .align(Alignment.TopCenter)
                .widthIn(max = 640.dp)
                .fillMaxSize()
                .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text("Todo Tracker", fontSize = FontSize.xl2, fontWeight = FontWeight.SemiBold, color = Palette.foreground)
                Text("A tiny local-first todo list.", fontSize = FontSize.sm, color = Palette.muted)
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
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(if (selected) Palette.foreground else Palette.background)
                                .selectable(selected = selected, role = Role.Tab) { filter = option }
                                .testTag(TestIds.filter(option.key))
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
                        )
                    }
                }
                if (todos.size > remaining) {
                    Text(
                        "Clear completed",
                        fontSize = FontSize.sm,
                        color = Palette.foreground.copy(alpha = 0.7f),
                        modifier = Modifier
                            .clickable(role = Role.Button, onClick = viewModel::clearCompleted)
                            .testTag(TestIds.clearCompleted),
                    )
                }
            }

            Box(Modifier.weight(1f)) {
                when {
                    !ui.hydrated -> EmptyText("Loading…", Modifier)
                    visible.isEmpty() -> EmptyText(
                        if (todos.isEmpty()) "No todos yet. Add your first one above." else "No ${filter.key} todos.",
                        Modifier.testTag(TestIds.empty),
                    )
                    else -> LazyColumn(
                        Modifier.fillMaxSize().testTag(TestIds.list),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        items(visible, key = { it.id }) { todo ->
                            TodoItem(todo, onToggle = viewModel::toggle, onRename = viewModel::rename, onRemove = viewModel::remove)
                        }
                    }
                }
            }

            Text(
                remainingLabel(remaining),
                fontSize = FontSize.xs,
                color = Palette.muted,
                modifier = Modifier.testTag(TestIds.remaining),
            )
        }

        ui.state.undoable?.let { entry ->
            Row(
                Modifier
                    .align(Alignment.BottomCenter)
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
                Text(entry.label, fontSize = FontSize.sm, color = Palette.card, modifier = Modifier.testTag(TestIds.undoLabel))
                Text(
                    "Undo",
                    fontSize = FontSize.sm,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.card,
                    textDecoration = TextDecoration.Underline,
                    modifier = Modifier
                        .clickable(role = Role.Button, onClick = viewModel::undo)
                        .testTag(TestIds.undoAction)
                        .padding(Spacing.s1),
                )
            }
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

private val inputStyle = TextStyle(fontSize = FontSize.base, color = Palette.foreground)

@Composable
private fun Field(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    style: TextStyle = inputStyle,
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
private fun TodoForm(onAdd: (TodoDraft) -> Unit) {
    var title by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.title) }
    var priority by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.priority) }
    var dueDate by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.dueDate) }
    val dateOk = isValidDueDate(dueDate)
    val canAdd = isValidTitle(title) && dateOk

    fun submit() {
        if (!canAdd) return
        onAdd(toTodoDraft(EMPTY_TODO_FORM.copy(title = title, priority = priority, dueDate = dueDate)))
        title = EMPTY_TODO_FORM.title
        priority = EMPTY_TODO_FORM.priority
        dueDate = EMPTY_TODO_FORM.dueDate
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Field(
            value = title,
            onValueChange = { title = it },
            placeholder = "What needs doing?",
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Todo title" }
                .testTag(TestIds.formTitle)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(Radius.md))
                    .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                    .selectableGroup()
                    .semantics { contentDescription = "Priority" }
                    .testTag(TestIds.formPriority),
            ) {
                listOf(TodoPriority.LOW, TodoPriority.MEDIUM, TodoPriority.HIGH).forEach { option ->
                    val selected = option == priority
                    Text(
                        option.key.replaceFirstChar(Char::uppercase),
                        fontSize = FontSize.sm,
                        color = if (selected) Palette.card else Palette.foreground,
                        modifier = Modifier
                            .background(if (selected) Palette.foreground else Palette.card)
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
                style = inputStyle.copy(fontSize = FontSize.sm),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                modifier = Modifier
                    .weight(1f)
                    .border(1.dp, if (dateOk) Palette.border else Palette.danger, RoundedCornerShape(Radius.md))
                    .semantics { contentDescription = "Due date" }
                    .testTag(TestIds.formDueDate)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1_5),
            )
        }
        Text(
            "Add",
            fontSize = FontSize.sm,
            fontWeight = FontWeight.Medium,
            color = Palette.card,
            modifier = Modifier
                .align(Alignment.End)
                .alpha(if (canAdd) 1f else 0.4f)
                .clip(RoundedCornerShape(Radius.md))
                .background(Palette.foreground)
                .clickable(enabled = canAdd, role = Role.Button) { submit() }
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
) {
    var editing by remember { mutableStateOf(false) }
    // onFocusChanged reports "unfocused" when the editor first attaches; only a real blur commits.
    var editorFocused by remember { mutableStateOf(false) }
    var draftTitle by remember(todo.title) { mutableStateOf(todo.title) }
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current

    fun commit() {
        if (!editing) return
        if (isValidTitle(draftTitle) && draftTitle.trim() != todo.title) onRename(todo.id, draftTitle) else draftTitle = todo.title
        editing = false
        editorFocused = false
    }

    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .testTag(TestIds.item(todo.title))
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2_5),
    ) {
        Box(
            Modifier
                .size(Spacing.s5)
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
                value = draftTitle,
                onValueChange = { draftTitle = it },
                placeholder = "",
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                modifier = Modifier
                    .weight(1f)
                    .focusRequester(focus)
                    .onFocusChanged {
                        if (it.isFocused) editorFocused = true else if (editorFocused) commit()
                    }
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
                modifier = Modifier
                    .weight(1f)
                    .alpha(if (todo.completed) 0.5f else 1f)
                    .clickable { editing = true }
                    .semantics { contentDescription = "Edit \"${todo.title}\"" }
                    .testTag(TestIds.itemTitle(todo.title)),
            )
        }

        todo.dueDate?.let {
            Text(it, fontSize = FontSize.xs, color = Palette.muted, modifier = Modifier.testTag(TestIds.itemDueDate(todo.title)))
        }

        val (badgeBg, badgeText) = Palette.priority(todo.priority)
        Text(
            todo.priority.key.replaceFirstChar(Char::uppercase),
            fontSize = FontSize.xs,
            color = badgeText,
            modifier = Modifier
                .clip(CircleShape)
                .background(badgeBg)
                .testTag(TestIds.itemPriority(todo.title))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s0_5),
        )

        Text(
            "×",
            fontSize = FontSize.lg,
            color = Palette.muted,
            modifier = Modifier
                .clickable(role = Role.Button) { onRemove(todo.id) }
                .semantics { contentDescription = "Delete \"${todo.title}\"" }
                .testTag(TestIds.itemDelete(todo.title))
                .padding(horizontal = Spacing.s1_5, vertical = Spacing.s0_5),
        )
    }
}
