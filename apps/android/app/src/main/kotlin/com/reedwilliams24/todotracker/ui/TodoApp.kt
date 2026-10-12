package com.reedwilliams24.todotracker.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
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
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reedwilliams24.todotracker.TodoViewModel
import com.reedwilliams24.todotracker.core.ConnectionStatus
import com.reedwilliams24.todotracker.core.DaybookProgress
import com.reedwilliams24.todotracker.core.DaybookSections
import com.reedwilliams24.todotracker.core.EMPTY_TODO_FORM
import com.reedwilliams24.todotracker.core.RECURRENCES
import com.reedwilliams24.todotracker.core.REMINDER_OFFSETS
import com.reedwilliams24.todotracker.core.Recurrence
import com.reedwilliams24.todotracker.core.ReminderOffset
import com.reedwilliams24.todotracker.core.STATS_DAYS
import com.reedwilliams24.todotracker.core.THEME_PREFERENCES
import com.reedwilliams24.todotracker.core.TestIds
import com.reedwilliams24.todotracker.core.ThemePreference
import com.reedwilliams24.todotracker.core.Todo
import com.reedwilliams24.todotracker.core.TodoDraft
import com.reedwilliams24.todotracker.core.TodoFilter
import com.reedwilliams24.todotracker.core.TodoPriority
import com.reedwilliams24.todotracker.core.TodoSort
import com.reedwilliams24.todotracker.core.canEdit
import com.reedwilliams24.todotracker.core.computeStats
import com.reedwilliams24.todotracker.core.connectionStatus
import com.reedwilliams24.todotracker.core.countCompleted
import com.reedwilliams24.todotracker.core.countRemaining
import com.reedwilliams24.todotracker.core.daybookProgress
import com.reedwilliams24.todotracker.core.daybookSections
import com.reedwilliams24.todotracker.core.filterTodos
import com.reedwilliams24.todotracker.core.hasQuickAddMeta
import com.reedwilliams24.todotracker.core.isOverdue
import com.reedwilliams24.todotracker.core.isValidDueDate
import com.reedwilliams24.todotracker.core.isValidTitle
import com.reedwilliams24.todotracker.core.parseQuickAdd
import com.reedwilliams24.todotracker.core.quickAddToDraft
import com.reedwilliams24.todotracker.core.sortTodos
import com.reedwilliams24.todotracker.core.subtaskProgress
import com.reedwilliams24.todotracker.core.upcomingDays
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.delay

@OptIn(ExperimentalComposeUiApi::class, ExperimentalLayoutApi::class)
@Composable
fun TodoApp(
    viewModel: TodoViewModel,
    account: @Composable () -> Unit = {},
    banner: @Composable () -> Unit = {},
    /** The account's session expired: the list stays visible but read-only until the user signs in again. */
    expired: Boolean = false,
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val theme by viewModel.theme.collectAsStateWithLifecycle()
    var filter by rememberSaveable { mutableStateOf(TodoFilter.ALL) }
    val todos = ui.state.todos
    val visible = remember(todos, filter, ui.sort) { sortTodos(filterTodos(todos, filter), ui.sort) }
    val visibleIds by rememberUpdatedState(visible.map { it.id })
    val remaining = countRemaining(todos)
    val t = rememberTranslator()
    val completedCount = countCompleted(todos)
    var selecting by rememberSaveable { mutableStateOf(false) }
    var selectedIds by remember { mutableStateOf(emptySet<String>()) }
    var confirmingDelete by remember { mutableStateOf(false) }
    val selected = visible.filter { it.id in selectedIds }.map { it.id }
    val allVisibleSelected = visible.isNotEmpty() && selected.size == visible.size
    val status = connectionStatus(ui.connection != null || expired, expired, ui.online, ui.connection)
    val editable = canEdit(status)

    fun exitSelectMode() {
        selecting = false
        selectedIds = emptySet()
        confirmingDelete = false
    }
    var tab by rememberSaveable { mutableStateOf(DaybookTab.TODAY) }
    val imeVisible = WindowInsets.isImeVisible
    val navInset = if (imeVisible) Spacing.s4 else 80.dp
    // Toasts sit above the tab bar, which is hidden while typing.
    val toastInset = if (imeVisible) 24.dp else 92.dp
    // Todos seen open on this view. Completing one keeps it in place (struck through) until the view is left.
    val seenOpen = remember(tab) { mutableSetOf<String>() }
    var doneOpen by rememberSaveable { mutableStateOf(false) }
    val showDone = doneOpen || filter == TodoFilter.COMPLETED
    val today = LocalDate.now().toString()
    todos.filter { !it.completed }.forEach { seenOpen.add(it.id) }
    val sections =
        remember(visible, today, todos) {
            val byId = visible.associateBy { it.id }
            val grouped =
                daybookSections(
                    visible.map { if (it.completed && it.id in seenOpen) it.copy(completed = false) else it },
                    today,
                )
            DaybookSections(
                slipped = grouped.slipped.mapNotNull { byId[it.id] },
                today = grouped.today.mapNotNull { byId[it.id] },
                later = grouped.later.mapNotNull { byId[it.id] },
                done = grouped.done.mapNotNull { byId[it.id] },
            )
        }
    val listState = rememberLazyListState()
    var draggingId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableFloatStateOf(0f) }

    /** The row under the dragged row's center, clamped to the first/last row when dragged past the ends. */
    fun dropTarget(id: String): String? {
        val items = listState.layoutInfo.visibleItemsInfo.filter { it.key in visibleIds }
        if (items.isEmpty()) return null
        val dragged = items.firstOrNull { it.key == id } ?: return null
        val center = dragged.offset + dragged.size / 2 + dragOffset
        val target =
            items.firstOrNull { center >= it.offset && center < it.offset + it.size }
                ?: if (center < items.first().offset) items.first() else items.last()
        return target.key as String
    }

    LaunchedEffect(editable) {
        if (!editable) {
            exitSelectMode()
            draggingId = null
            dragOffset = 0f
        }
    }

    fun endDrag() {
        val id = draggingId
        val target = id?.let(::dropTarget)
        if (id != null && target != null && target != id) viewModel.reorder(visibleIds, id, target)
        draggingId = null
        dragOffset = 0f
    }

    Box(
        Modifier.fillMaxSize()
            .background(Palette.background)
            .semantics { testTagsAsResourceId = true }
            .safeDrawingPadding()
    ) {
        if (tab != DaybookTab.TODAY) {
            Column(
                Modifier.align(Alignment.TopCenter)
                    .widthIn(max = 640.dp)
                    .fillMaxSize()
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = navInset),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                if (tab == DaybookTab.UPCOMING) {
                    UpcomingScreen(todos, ui.sort, today, t) { todo ->
                        TodoItem(
                            todo,
                            t,
                            today = today,
                            onToggle = viewModel::toggle,
                            onRename = viewModel::rename,
                            onRemove = viewModel::remove,
                            onAddSubtask = viewModel::addSubtask,
                            onToggleSubtask = viewModel::toggleSubtask,
                            onRemoveSubtask = viewModel::removeSubtask,
                            enabled = editable,
                        )
                    }
                } else {
                    ScreenTitle(t("stats.title"))
                    if (ui.hydrated) StatsPanel(todos, t)
                }
            }
        }
        if (tab == DaybookTab.TODAY)
            LazyColumn(
                Modifier.align(Alignment.TopCenter)
                    .widthIn(max = 640.dp)
                    .fillMaxSize()
                    .then(if (ui.hydrated && visible.isNotEmpty()) Modifier.testTag(TestIds.list) else Modifier),
                state = listState,
                contentPadding =
                    PaddingValues(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = navInset),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                item(key = "chrome") {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                t(greetingKey()),
                                fontSize = FontSize.sm,
                                fontWeight = FontWeight.Medium,
                                color = Palette.muted,
                                modifier = Modifier.weight(1f),
                            )
                            ThemeToggle(theme, t, onSelect = viewModel::setTheme)
                        }
                        account()
                        banner()
                        ConnectionBanner(status, t)
                        if (ui.hydrated) TodayHeader(daybookProgress(todos, Instant.now()), t)

                        val context = LocalContext.current
                        val notificationPermission =
                            rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
                                viewModel.syncReminders()
                            }
                        TodoForm(
                            t,
                            enabled = editable,
                            onAdd = viewModel::add,
                            onPickReminder = {
                                if (
                                    Build.VERSION.SDK_INT >= 33 &&
                                        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                                            PackageManager.PERMISSION_GRANTED
                                ) {
                                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                                }
                            },
                        )

                        FlowRow(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                        ) {
                            Row(
                                Modifier.selectableGroup().semantics { contentDescription = t("filter.label") },
                                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                            ) {
                                TodoFilter.entries.forEach { option ->
                                    val selected = filter == option
                                    Text(
                                        t("filter.${option.key}"),
                                        fontSize = FontSize.sm,
                                        color = if (selected) Palette.accentInk else Palette.muted,
                                        fontWeight = if (selected) FontWeight.SemiBold else null,
                                        modifier =
                                            Modifier.clip(CircleShape)
                                                .background(if (selected) Palette.accent else Palette.background)
                                                .selectable(selected = selected, role = Role.Tab) { filter = option }
                                                .testTag(TestIds.filter(option.key))
                                                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
                                    )
                                }
                            }
                            Row(
                                Modifier.align(Alignment.CenterVertically),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                            ) {
                                if (todos.isNotEmpty()) {
                                    LinkText(
                                        t(if (selecting) "select.done" else "select.enter"),
                                        TestIds.selectMode,
                                        enabled = editable,
                                    ) {
                                        if (selecting) exitSelectMode() else selecting = true
                                    }
                                }
                                if (completedCount > 0 && !selecting) {
                                    LinkText(
                                        t("list.clearCompleted", "count" to completedCount),
                                        TestIds.clearCompleted,
                                        enabled = editable,
                                        onClick = viewModel::clearCompleted,
                                    )
                                }
                            }
                        }

                        Row(
                            Modifier.selectableGroup()
                                .semantics { contentDescription = t("sort.ariaLabel") }
                                .testTag(TestIds.sort),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                        ) {
                            Text(
                                t("sort.label"),
                                fontSize = FontSize.sm,
                                color = Palette.muted,
                                modifier = Modifier.padding(end = Spacing.s1),
                            )
                            TodoSort.entries.forEach { option ->
                                val selected = ui.sort == option
                                Text(
                                    when (option) {
                                        TodoSort.DUE -> t("sort.due")
                                        TodoSort.MANUAL -> t("sort.manual")
                                        TodoSort.PRIORITY -> t("sort.priority")
                                    },
                                    fontSize = FontSize.sm,
                                    color = if (selected) Palette.accentInk else Palette.muted,
                                    modifier =
                                        Modifier.clip(CircleShape)
                                            .background(if (selected) Palette.accent else Palette.background)
                                            .selectable(selected = selected, role = Role.Tab) {
                                                viewModel.setSort(option)
                                            }
                                            .testTag(TestIds.sortOption(option.key))
                                            .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
                                )
                            }
                        }

                        if (selecting) {
                            BulkBar(
                                t = t,
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
                    }
                }
                when {
                    !ui.hydrated -> item(key = "loading") { EmptyText(t("list.loading"), Modifier) }
                    visible.isEmpty() ->
                        item(key = "empty") {
                            EmptyText(
                                if (todos.isEmpty()) t("list.empty")
                                else t("list.emptyFiltered", "filter" to filter.key),
                                Modifier.testTag(TestIds.empty),
                            )
                        }
                    else -> {
                        for ((section, rows) in
                            listOf(
                                "slipped" to sections.slipped,
                                "today" to sections.today,
                                "later" to sections.later,
                                "done" to sections.done,
                            )) {
                            if (rows.isEmpty()) continue
                            item(key = "section-$section") {
                                SectionHeader(
                                    t("daybook.section.$section"),
                                    rows.size,
                                    Modifier.testTag(TestIds.daybookSection(section)),
                                ) {
                                    if (section == "done" && filter != TodoFilter.COMPLETED) {
                                        LinkText(
                                            t(if (showDone) "daybook.done.hide" else "daybook.done.show"),
                                            TestIds.daybookDoneToggle,
                                        ) {
                                            doneOpen = !doneOpen
                                        }
                                    }
                                }
                            }
                            if (section == "done" && !showDone) continue
                            items(rows, key = { it.id }) { todo ->
                                val dragging = draggingId == todo.id
                                TodoItem(
                                    todo,
                                    t,
                                    today = today,
                                    onToggle = viewModel::toggle,
                                    onRename = viewModel::rename,
                                    onRemove = viewModel::remove,
                                    onAddSubtask = viewModel::addSubtask,
                                    onToggleSubtask = viewModel::toggleSubtask,
                                    onRemoveSubtask = viewModel::removeSubtask,
                                    enabled = editable,
                                    selection =
                                        if (selecting) {
                                            Selection(todo.id in selectedIds) { id ->
                                                selectedIds =
                                                    if (id in selectedIds) selectedIds - id else selectedIds + id
                                            }
                                        } else {
                                            null
                                        },
                                    modifier =
                                        Modifier.then(if (dragging) Modifier else Modifier.animateItem())
                                            .zIndex(if (dragging) 1f else 0f)
                                            .graphicsLayer { translationY = if (dragging) dragOffset else 0f }
                                            .then(
                                                if (dragging) Modifier.shadow(6.dp, RoundedCornerShape(Radius.lg))
                                                else Modifier
                                            )
                                            .semantics { contentDescription = t("item.dragHint") }
                                            .pointerInput(todo.id, editable) {
                                                if (!editable) return@pointerInput
                                                detectDragGesturesAfterLongPress(
                                                    onDragStart = {
                                                        draggingId = todo.id
                                                        dragOffset = 0f
                                                    },
                                                    onDrag = { change, amount ->
                                                        change.consume()
                                                        dragOffset += amount.y
                                                    },
                                                    onDragEnd = ::endDrag,
                                                    onDragCancel = {
                                                        draggingId = null
                                                        dragOffset = 0f
                                                    },
                                                )
                                            },
                                )
                            }
                        }
                    }
                }
                item(key = "remaining") {
                    Text(
                        t("list.remaining", "count" to remaining),
                        fontSize = FontSize.xs,
                        color = Palette.muted,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag(TestIds.remaining),
                    )
                }
            }

        // Like iOS/web keyboards, typing takes the bottom of the screen; the tab bar comes back on dismiss.
        if (!imeVisible) {
            DaybookNavigationBar(tab, t, Modifier.align(Alignment.BottomCenter)) { next ->
                if (next != DaybookTab.TODAY) exitSelectMode()
                tab = next
            }
        }

        if (ui.pushFailed) {
            Text(
                t("sync.pushFailed"),
                fontSize = FontSize.sm,
                color = Palette.card,
                modifier =
                    Modifier.align(Alignment.BottomCenter)
                        .imePadding()
                        .padding(bottom = toastInset + 44.dp, start = Spacing.s4, end = Spacing.s4)
                        .clip(RoundedCornerShape(Radius.lg))
                        .background(Palette.danger)
                        .semantics { liveRegion = LiveRegionMode.Assertive }
                        .testTag(TestIds.syncError)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            )
        }

        ui.state.undoable?.let { entry ->
            Row(
                Modifier.align(Alignment.BottomCenter)
                    .imePadding()
                    .padding(bottom = toastInset)
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
                    t("undo.action"),
                    fontSize = FontSize.sm,
                    fontWeight = FontWeight.SemiBold,
                    color = Palette.card,
                    textDecoration = TextDecoration.Underline,
                    modifier =
                        Modifier.alpha(if (editable) 1f else 0.5f)
                            .clickable(enabled = editable, role = Role.Button, onClick = viewModel::undo)
                            .testTag(TestIds.undoAction)
                            .padding(Spacing.s1),
                )
            }
        }
    }
}

/** UI copy for the device's preferred locales (spec/features/localization.md). */
@Composable
internal fun LinkText(label: String, tag: String, enabled: Boolean = true, onClick: () -> Unit) {
    Text(
        label,
        fontSize = FontSize.sm,
        color = Palette.foreground.copy(alpha = if (enabled) 0.7f else 0.3f),
        modifier = Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick).testTag(tag),
    )
}

/** Reconnecting / offline banner for the signed-in list (spec/features/realtime.md#connection-status). */
@Composable
private fun ConnectionBanner(status: ConnectionStatus, t: Translator) {
    if (status != ConnectionStatus.RECONNECTING && status != ConnectionStatus.OFFLINE) return
    Row(
        Modifier.fillMaxWidth()
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
            .background(Palette.card, RoundedCornerShape(Radius.md))
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
            .testTag(TestIds.connectionBanner)
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (status == ConnectionStatus.RECONNECTING) {
            CircularProgressIndicator(Modifier.size(Spacing.s4), color = Palette.muted, strokeWidth = 2.dp)
            Column(Modifier.weight(1f)) {
                Text(
                    t("connection.reconnecting"),
                    fontSize = FontSize.sm,
                    fontWeight = FontWeight.Medium,
                    color = Palette.foreground,
                )
                Text(t("connection.readOnly"), fontSize = FontSize.xs, color = Palette.muted)
            }
        } else {
            Text(t("connection.offline"), fontSize = FontSize.sm, color = Palette.foreground)
        }
    }
}

@Composable
internal fun ActionButton(
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
    t: Translator,
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
            .semantics { contentDescription = t("bulk.label") }
            .testTag(TestIds.bulkBar)
            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (confirmingDelete) {
            Text(
                t("bulk.confirm", "count" to count),
                fontSize = FontSize.sm,
                fontWeight = FontWeight.Medium,
                color = Palette.foreground,
                modifier = Modifier.weight(1f),
            )
            ActionButton(t("bulk.cancel"), TestIds.bulkDeleteCancel, onClick = onCancelDelete)
            ActionButton(t("bulk.delete"), TestIds.bulkDeleteConfirm, danger = true, onClick = onConfirmDelete)
        } else {
            Text(
                t("select.count", "count" to count),
                fontSize = FontSize.sm,
                color = Palette.muted,
                modifier = Modifier.testTag(TestIds.selectedCount),
            )
            Text(
                t(if (allSelected) "select.none" else "select.all"),
                fontSize = FontSize.sm,
                color = Palette.foreground,
                modifier =
                    Modifier.weight(1f).clickable(role = Role.Button, onClick = onSelectAll).testTag(TestIds.selectAll),
            )
            ActionButton(t("bulk.toggle"), TestIds.bulkToggle, enabled = count > 0, onClick = onToggle)
            ActionButton(t("bulk.delete"), TestIds.bulkDelete, enabled = count > 0, danger = true, onClick = onDelete)
        }
    }
}

private data class Selection(val selected: Boolean, val onSelect: (String) -> Unit)

@Composable
private fun SelectableItem(todo: Todo, t: Translator, selection: Selection) {
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
                .semantics { contentDescription = t("select.item", "title" to todo.title) }
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
        Box(Modifier.size(Spacing.s2).clip(CircleShape).background(Palette.priority(todo.priority)))
    }
}

@Composable
private fun StatsPanel(todos: List<Todo>, t: Translator) {
    val stats = remember(todos) { computeStats(todos, Instant.now()) }
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
    ) {
        run {
            Column(Modifier.padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                Row(Modifier.fillMaxWidth()) {
                    StatValue(
                        t("stats.completed"),
                        stats.totalCompleted.toString(),
                        TestIds.statsTotal,
                        Modifier.weight(1f),
                    )
                    StatValue(
                        t("stats.currentStreak"),
                        t("stats.days", "count" to stats.currentStreak),
                        TestIds.statsCurrent,
                        Modifier.weight(1f),
                    )
                    StatValue(
                        t("stats.longestStreak"),
                        t("stats.days", "count" to stats.longestStreak),
                        TestIds.statsLongest,
                        Modifier.weight(1f),
                    )
                }
                val max = maxOf(1, stats.perDay.maxOf { it.count })
                Row(
                    Modifier.fillMaxWidth()
                        .height(64.dp)
                        .semantics { contentDescription = t("stats.chart", "days" to STATS_DAYS) }
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
                                .semantics {
                                    contentDescription = t("stats.day", "date" to day.date, "count" to day.count)
                                }
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
private fun ThemeToggle(preference: ThemePreference, t: Translator, onSelect: (ThemePreference) -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(Radius.md))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
            .selectableGroup()
            .semantics { contentDescription = t("theme.label") }
            .testTag(TestIds.themeToggle)
    ) {
        THEME_PREFERENCES.forEach { option ->
            val selected = option == preference
            Text(
                t("theme.${option.key}"),
                fontSize = FontSize.xs,
                color = if (selected) Palette.accentInk else Palette.foreground.copy(alpha = 0.7f),
                modifier =
                    Modifier.background(if (selected) Palette.accent else Color.Transparent)
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

@Composable internal fun inputStyle() = TextStyle(fontSize = FontSize.base, color = Palette.foreground)

@Composable
internal fun Field(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    style: TextStyle = inputStyle(),
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    enabled: Boolean = true,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
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
    enabled: Boolean = true,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
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
private fun TodoForm(t: Translator, enabled: Boolean, onAdd: (TodoDraft) -> Unit, onPickReminder: () -> Unit) {
    var title by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.title) }
    var priority by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.priority) }
    var dueDate by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.dueDate) }
    var reminder by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.reminder) }
    var recurrence by rememberSaveable { mutableStateOf(EMPTY_TODO_FORM.recurrence) }
    val parsed = remember(title) { parseQuickAdd(title) }
    val dateOk = isValidDueDate(dueDate)
    val canAdd = isValidTitle(parsed.title) && dateOk

    fun submit() {
        if (!canAdd || !enabled) return
        val draft = quickAddToDraft(parsed, priority, dueDate).copy(recurrence = Recurrence.fromKey(recurrence))
        onAdd(draft.copy(reminder = if (draft.dueDate == null) null else ReminderOffset.fromKey(reminder)))
        title = EMPTY_TODO_FORM.title
        priority = EMPTY_TODO_FORM.priority
        dueDate = EMPTY_TODO_FORM.dueDate
        reminder = EMPTY_TODO_FORM.reminder
        recurrence = EMPTY_TODO_FORM.recurrence
    }

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .alpha(if (enabled) 1f else 0.5f)
            .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Field(
            enabled = enabled,
            value = title,
            onValueChange = { title = it },
            placeholder = t("form.title.placeholder"),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            modifier =
                Modifier.fillMaxWidth()
                    .semantics { contentDescription = t("form.title.label") }
                    .testTag(TestIds.formTitle)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(
                Modifier.clip(RoundedCornerShape(Radius.md))
                    .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                    .selectableGroup()
                    .semantics { contentDescription = t("form.priority.label") }
                    .testTag(TestIds.formPriority)
            ) {
                listOf(TodoPriority.LOW, TodoPriority.MEDIUM, TodoPriority.HIGH).forEach { option ->
                    val selected = option == priority
                    Text(
                        t("priority.${option.key}"),
                        fontSize = FontSize.sm,
                        color = if (selected) Palette.accentInk else Palette.foreground,
                        modifier =
                            Modifier.background(if (selected) Palette.accent else Palette.card)
                                .selectable(selected = selected, enabled = enabled, role = Role.RadioButton) {
                                    priority = option
                                }
                                .testTag(TestIds.formPriorityOption(option.key))
                                .padding(horizontal = Spacing.s2_5, vertical = Spacing.s1_5),
                    )
                }
            }
            Field(
                enabled = enabled,
                value = dueDate,
                onValueChange = { dueDate = it },
                placeholder = t("form.dueDate.placeholder"),
                style = inputStyle().copy(fontSize = FontSize.sm),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                modifier =
                    Modifier.weight(1f)
                        .border(1.dp, if (dateOk) Palette.border else Palette.danger, RoundedCornerShape(Radius.md))
                        .semantics { contentDescription = t("form.dueDate.label") }
                        .testTag(TestIds.formDueDate)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1_5),
            )
        }
        val reminderEnabled = dueDate.isNotEmpty()
        Row(
            Modifier.fillMaxWidth()
                .alpha(if (reminderEnabled) 1f else 0.4f)
                .clip(RoundedCornerShape(Radius.md))
                .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                .selectableGroup()
                .semantics { contentDescription = t("form.reminder.label") }
                .testTag(TestIds.formReminder)
        ) {
            (listOf("" to t("reminder.none")) + REMINDER_OFFSETS.map { it.key to t("reminder.${it.key}") }).forEach {
                (key, label) ->
                val selected = key == reminder
                Text(
                    label,
                    fontSize = FontSize.xs,
                    color = if (selected) Palette.accentInk else Palette.foreground,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier.weight(1f)
                            .background(if (selected) Palette.accent else Palette.card)
                            .selectable(
                                selected = selected,
                                enabled = reminderEnabled && enabled,
                                role = Role.RadioButton,
                            ) {
                                reminder = key
                                if (key.isNotEmpty()) onPickReminder()
                            }
                            .testTag(TestIds.formReminderOption(key))
                            .padding(horizontal = Spacing.s1, vertical = Spacing.s1_5),
                )
            }
        }
        Row(
            Modifier.clip(RoundedCornerShape(Radius.md))
                .border(1.dp, Palette.border, RoundedCornerShape(Radius.md))
                .selectableGroup()
                .semantics { contentDescription = t("form.recurrence.label") }
                .testTag(TestIds.formRecurrence)
        ) {
            (listOf("" to t("recurrence.none")) + RECURRENCES.map { it.key to t("recurrence.${it.key}") }).forEach {
                (key, label) ->
                val selected = key == recurrence
                Text(
                    label,
                    fontSize = FontSize.sm,
                    color = if (selected) Palette.accentInk else Palette.foreground,
                    modifier =
                        Modifier.background(if (selected) Palette.accent else Palette.card)
                            .selectable(selected = selected, enabled = enabled, role = Role.RadioButton) {
                                recurrence = key
                            }
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
                    Text(t("quickAdd.willAdd"), fontSize = FontSize.xs, color = Palette.muted)
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
                        parsed.dueDate?.let { t("quickAdd.due", "date" to it) },
                        parsed.priority?.let { t("quickAdd.priority", "priority" to t("priority.${it.key}")) },
                    ) + parsed.tags.map { "#$it" }
                if (meta.isNotEmpty()) Text(meta.joinToString("  ·  "), fontSize = FontSize.xs, color = Palette.muted)
            }
        }
        Text(
            t("form.add"),
            fontSize = FontSize.sm,
            fontWeight = FontWeight.Medium,
            color = Palette.card,
            modifier =
                Modifier.align(Alignment.End)
                    .alpha(if (canAdd && enabled) 1f else 0.4f)
                    .clip(RoundedCornerShape(Radius.md))
                    .background(Palette.foreground)
                    .clickable(enabled = canAdd && enabled, role = Role.Button) { submit() }
                    .semantics { contentDescription = t("form.add.label") }
                    .testTag(TestIds.formSubmit)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        )
    }
}

@Composable
private fun TodoItem(
    todo: Todo,
    t: Translator,
    today: String? = null,
    onToggle: (String) -> Unit,
    onRename: (String, String) -> Unit,
    onRemove: (String) -> Unit,
    onAddSubtask: (String, String) -> Unit,
    onToggleSubtask: (String, String) -> Unit,
    onRemoveSubtask: (String, String) -> Unit,
    enabled: Boolean = true,
    selection: Selection? = null,
    modifier: Modifier = Modifier,
) {
    if (selection != null) {
        SelectableItem(todo, t, selection)
        return
    }
    var expanded by rememberSaveable(todo.id) { mutableStateOf(false) }
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

    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .border(1.dp, Palette.border, RoundedCornerShape(Radius.lg))
            .background(Palette.card)
            .testTag(TestIds.item(todo.title))
            .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2_5),
        ) {
            Box(
                Modifier.size(Spacing.s5)
                    .clip(CircleShape)
                    .border(2.dp, if (todo.completed) Palette.success else Palette.border, CircleShape)
                    .background(if (todo.completed) Palette.success else Palette.card)
                    .alpha(if (enabled) 1f else 0.4f)
                    .toggleable(value = todo.completed, enabled = enabled, role = Role.Checkbox) { onToggle(todo.id) }
                    .semantics {
                        contentDescription =
                            t(if (todo.completed) "item.markActive" else "item.markComplete", "title" to todo.title)
                    }
                    .testTag(TestIds.itemToggle(todo.title)),
                contentAlignment = Alignment.Center,
            ) {
                if (todo.completed) Text("✓", color = Palette.card, fontSize = FontSize.xs)
            }

            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s0_5)) {
                if (editing) {
                    LaunchedEffect(Unit) { focus.requestFocus() }
                    Field(
                        value = draft,
                        onValueChange = { draft = it },
                        placeholder = "",
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                        modifier =
                            Modifier.fillMaxWidth()
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
                                .semantics { contentDescription = t("item.editTitle") }
                                .testTag(TestIds.itemEditInput)
                                .padding(vertical = Spacing.s1),
                    )
                } else {
                    Text(
                        todo.title,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (todo.completed) Palette.muted else Palette.foreground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textDecoration = if (todo.completed) TextDecoration.LineThrough else null,
                        modifier =
                            Modifier.fillMaxWidth()
                                .clickable(
                                    enabled = enabled,
                                    role = Role.Button,
                                    onClickLabel = t("item.editClickLabel"),
                                ) {
                                    editing = true
                                }
                                .semantics { contentDescription = t("item.edit", "title" to todo.title) }
                                .testTag(TestIds.itemTitle(todo.title)),
                    )
                }

                if (todo.dueDate != null || todo.reminder != null || todo.recurrence != null) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        todo.dueDate?.let {
                            val color = if (overdue) Palette.note else Palette.muted
                            Row(
                                Modifier.semantics(mergeDescendants = true) {
                                    contentDescription = t(if (overdue) "item.overdue" else "item.due", "date" to it)
                                },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                if (overdue) {
                                    Text(
                                        if (today != null) t("item.slippedBadge", "day" to slippedFrom(it, today))
                                        else t("item.overdueBadge"),
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

                        todo.reminder?.let {
                            Text(
                                t("reminder.${it.key}"),
                                fontSize = FontSize.xs,
                                color = Palette.muted,
                                maxLines = 1,
                                modifier =
                                    Modifier.semantics {
                                            contentDescription =
                                                t("item.reminder", "label" to t("reminder.${it.key}").lowercase())
                                        }
                                        .testTag(TestIds.itemReminder(todo.title)),
                            )
                        }

                        todo.recurrence?.let {
                            Text(
                                t("item.recurrence", "label" to t("recurrence.${it.key}")),
                                fontSize = FontSize.xs,
                                color = Palette.muted,
                                modifier = Modifier.testTag(TestIds.itemRecurrence(todo.title)),
                            )
                        }
                    }
                }
            }
            val progress = subtaskProgress(todo)
            Row(
                Modifier.clip(CircleShape)
                    .background(Palette.soft)
                    .clickable(role = Role.Button) { expanded = !expanded }
                    .semantics {
                        contentDescription =
                            t(if (expanded) "subtasks.collapse" else "subtasks.expand", "title" to todo.title)
                    }
                    .testTag(TestIds.itemSubtasksToggle(todo.title))
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s0_5),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (progress.total > 0) progress.label else "+",
                    fontSize = FontSize.xs,
                    color = Palette.muted,
                    modifier = Modifier.testTag(TestIds.itemSubtaskProgress(todo.title)),
                )
                Text(if (expanded) "▾" else "▸", fontSize = FontSize.xs, color = Palette.muted)
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(Modifier.size(Spacing.s2).clip(CircleShape).background(Palette.priority(todo.priority)))
                Text(
                    t("priority.${todo.priority.key}"),
                    fontSize = FontSize.xs,
                    color = Palette.muted,
                    modifier = Modifier.testTag(TestIds.itemPriority(todo.title)),
                )
            }

            Text(
                "×",
                fontSize = FontSize.lg,
                color = Palette.muted,
                modifier =
                    Modifier.alpha(if (enabled) 1f else 0.4f)
                        .clickable(enabled = enabled, role = Role.Button) { onRemove(todo.id) }
                        .semantics { contentDescription = t("item.delete", "title" to todo.title) }
                        .testTag(TestIds.itemDelete(todo.title))
                        .padding(horizontal = Spacing.s1_5, vertical = Spacing.s0_5),
            )
        }
        if (expanded) SubtaskPanel(todo, t, enabled, onAddSubtask, onToggleSubtask, onRemoveSubtask)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SubtaskPanel(
    todo: Todo,
    t: Translator,
    enabled: Boolean,
    onAdd: (String, String) -> Unit,
    onToggle: (String, String) -> Unit,
    onRemove: (String, String) -> Unit,
) {
    var title by remember(todo.id) { mutableStateOf("") }
    var inputFocused by remember { mutableStateOf(false) }
    val panel = remember { BringIntoViewRequester() }
    val subtaskCount = todo.subtasks.orEmpty().size
    // The whole page scrolls, so keep the panel above the keyboard while typing subtasks (after the IME animation).
    LaunchedEffect(inputFocused, subtaskCount) {
        if (inputFocused) {
            delay(350)
            panel.bringIntoView()
        }
    }

    fun submit() {
        if (!isValidTitle(title)) return
        onAdd(todo.id, title)
        title = ""
    }

    Column(Modifier.fillMaxWidth().bringIntoViewRequester(panel).padding(start = Spacing.s5 + Spacing.s2_5)) {
        todo.subtasks.orEmpty().forEach { subtask ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag(TestIds.subtask(subtask.title)),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    Modifier.size(Spacing.s4)
                        .clip(RoundedCornerShape(Radius.sm))
                        .border(1.5.dp, Palette.foreground, RoundedCornerShape(Radius.sm))
                        .background(if (subtask.completed) Palette.foreground else Palette.card)
                        .alpha(if (enabled) 1f else 0.4f)
                        .toggleable(value = subtask.completed, enabled = enabled, role = Role.Checkbox) {
                            onToggle(todo.id, subtask.id)
                        }
                        .semantics {
                            contentDescription =
                                t(
                                    if (subtask.completed) "subtask.markActive" else "subtask.markComplete",
                                    "title" to subtask.title,
                                )
                        }
                        .testTag(TestIds.subtaskToggle(subtask.title)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (subtask.completed) Text("✓", color = Palette.card, fontSize = FontSize.xs)
                }
                Text(
                    subtask.title,
                    fontSize = FontSize.sm,
                    color = Palette.foreground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textDecoration = if (subtask.completed) TextDecoration.LineThrough else null,
                    modifier = Modifier.weight(1f).alpha(if (subtask.completed) 0.5f else 1f),
                )
                Text(
                    "×",
                    fontSize = FontSize.base,
                    color = Palette.muted,
                    modifier =
                        Modifier.clickable(enabled = enabled, role = Role.Button) { onRemove(todo.id, subtask.id) }
                            .semantics { contentDescription = t("subtask.delete", "title" to subtask.title) }
                            .testTag(TestIds.subtaskDelete(subtask.title))
                            .padding(horizontal = Spacing.s1_5),
                )
            }
        }
        Field(
            enabled = enabled,
            value = title,
            onValueChange = { title = it },
            placeholder = t("subtasks.add.placeholder"),
            style = inputStyle().copy(fontSize = FontSize.sm),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            modifier =
                Modifier.fillMaxWidth()
                    .onPreviewKeyEvent { event ->
                        if (event.key == Key.Enter) {
                            submit()
                            true
                        } else {
                            false
                        }
                    }
                    .semantics { contentDescription = t("subtasks.add.label", "title" to todo.title) }
                    .onFocusChanged { inputFocused = it.isFocused }
                    .testTag(TestIds.subtaskInput(todo.title))
                    .padding(vertical = Spacing.s1),
        )
    }
}

enum class DaybookTab(val key: String) {
    TODAY("today"),
    UPCOMING("upcoming"),
    STATS("stats"),
}

/** "Fri" for a due date in the last 6 days, else e.g. "Oct 2", in the device locale. */
private fun slippedFrom(dueDate: String, today: String): String {
    val due = runCatching { LocalDate.parse(dueDate) }.getOrNull() ?: return dueDate
    val days = runCatching { ChronoUnit.DAYS.between(due, LocalDate.parse(today)) }.getOrDefault(7)
    return due.format(DateTimeFormatter.ofPattern(if (days <= 6) "EEE" else "MMM d"))
}

@Composable
private fun ScreenTitle(text: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s0_5)) {
        Text(
            text,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.5).sp,
            color = Palette.foreground,
            modifier = Modifier.semantics { heading() },
        )
        if (subtitle != null) Text(subtitle, fontSize = FontSize.sm, color = Palette.muted)
    }
}

private fun greetingKey(): String {
    val hour = LocalTime.now().hour
    return when {
        hour < 12 -> "daybook.greeting.morning"
        hour < 18 -> "daybook.greeting.afternoon"
        else -> "daybook.greeting.evening"
    }
}

@Composable
private fun TodayHeader(progress: DaybookProgress, t: Translator) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s0_5)) {
            Text(
                LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMM d")),
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
                color = Palette.foreground,
                maxLines = 1,
                modifier = Modifier.semantics { heading() },
            )
        }
        Text(t("daybook.left", "count" to progress.total - progress.done), fontSize = 13.sp, color = Palette.muted)
        ProgressRing(progress, t)
    }
}

/** Daybook progress ring: today's completions out of today's load. */
@Composable
private fun ProgressRing(progress: DaybookProgress, t: Translator) {
    val track = Palette.border
    val fill = Palette.accent
    val fraction = if (progress.total > 0) progress.done.toFloat() / progress.total else 0f
    Box(
        Modifier.size(50.dp).semantics(mergeDescendants = false) {
            contentDescription = t("daybook.progress", "done" to progress.done, "total" to progress.total)
        },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize().padding(3.dp)) {
            val stroke = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round)
            drawArc(track, 0f, 360f, useCenter = false, style = Stroke(width = 6.dp.toPx()))
            if (fraction > 0f) drawArc(fill, -90f, 360f * fraction, useCenter = false, style = stroke)
        }
        Text(
            "${progress.done}/${progress.total}",
            fontSize = FontSize.xs,
            fontWeight = FontWeight.Bold,
            color = Palette.foreground,
            modifier = Modifier.testTag(TestIds.daybookProgress),
        )
    }
}

@Composable
private fun SectionHeader(
    title: String,
    count: Int,
    modifier: Modifier = Modifier,
    trailing: @Composable () -> Unit = {},
) {
    Row(
        Modifier.fillMaxWidth().padding(top = Spacing.s2, start = Spacing.s1, end = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1_5),
    ) {
        Row(
            modifier.semantics(mergeDescendants = true) { heading() },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1_5),
        ) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Palette.foreground)
            Text(count.toString(), fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Palette.muted)
        }
        Spacer(Modifier.weight(1f))
        trailing()
    }
}

@Composable
private fun UpcomingScreen(
    todos: List<Todo>,
    sort: TodoSort,
    today: String,
    t: Translator,
    row: @Composable (Todo) -> Unit,
) {
    val days = remember(todos, sort, today) { upcomingDays(sortTodos(todos, sort), today) }
    ScreenTitle(t("upcoming.title"), t("upcoming.subtitle"))
    if (days.isEmpty()) {
        EmptyText(t("upcoming.empty"), Modifier.testTag(TestIds.upcomingEmpty))
        return
    }
    LazyColumn(
        Modifier.fillMaxSize().testTag(TestIds.upcomingList),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        for (day in days) {
            item(key = "day-${day.date}") {
                SectionHeader(
                    dayLabel(day.date, today, t),
                    day.todos.size,
                    Modifier.testTag(TestIds.upcomingDay(day.date)),
                )
            }
            items(day.todos, key = { it.id }) { todo -> row(todo) }
        }
    }
}

private fun dayLabel(date: String, today: String, t: Translator): String {
    val day = runCatching { LocalDate.parse(date) }.getOrNull() ?: return date
    return when (ChronoUnit.DAYS.between(LocalDate.parse(today), day)) {
        0L -> t("upcoming.today")
        1L -> t("upcoming.tomorrow")
        else -> day.format(DateTimeFormatter.ofPattern("EEE, MMM d"))
    }
}

@Composable
private fun DaybookNavigationBar(
    tab: DaybookTab,
    t: Translator,
    modifier: Modifier = Modifier,
    onSelect: (DaybookTab) -> Unit,
) {
    NavigationBar(
        modifier.fillMaxWidth().border(1.dp, Palette.border).semantics { contentDescription = t("nav.label") },
        containerColor = Palette.card,
        tonalElevation = 0.dp,
    ) {
        DaybookTab.entries.forEach { option ->
            NavigationBarItem(
                selected = tab == option,
                onClick = { onSelect(option) },
                icon = { TabIcon(option) },
                label = { Text(t("nav.${option.key}"), fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                colors =
                    NavigationBarItemDefaults.colors(
                        selectedIconColor = Palette.accent,
                        selectedTextColor = Palette.accent,
                        indicatorColor = Palette.soft,
                        unselectedIconColor = Palette.muted,
                        unselectedTextColor = Palette.muted,
                    ),
                modifier =
                    Modifier.testTag(if (option == DaybookTab.STATS) TestIds.statsToggle else TestIds.tab(option.key)),
            )
        }
    }
}

@Composable
private fun TabIcon(tab: DaybookTab) {
    val color = androidx.compose.material3.LocalContentColor.current
    Canvas(Modifier.size(20.dp)) {
        val w = size.width
        val stroke = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
        when (tab) {
            DaybookTab.TODAY -> {
                drawCircle(color, radius = w * 0.2f, style = stroke)
                for (i in 0 until 8) {
                    val angle = Math.toRadians(i * 45.0)
                    val c = Offset(w / 2, w / 2)
                    val dir = Offset(kotlin.math.cos(angle).toFloat(), kotlin.math.sin(angle).toFloat())
                    drawLine(color, c + dir * (w * 0.34f), c + dir * (w * 0.46f), 2.dp.toPx(), StrokeCap.Round)
                }
            }
            DaybookTab.UPCOMING -> {
                drawRoundRect(
                    color,
                    topLeft = Offset(w * 0.1f, w * 0.18f),
                    size = Size(w * 0.8f, w * 0.72f),
                    cornerRadius = CornerRadius(w * 0.14f),
                    style = stroke,
                )
                drawLine(color, Offset(w * 0.1f, w * 0.4f), Offset(w * 0.9f, w * 0.4f), 2.dp.toPx())
                drawLine(
                    color,
                    Offset(w * 0.32f, w * 0.08f),
                    Offset(w * 0.32f, w * 0.26f),
                    2.dp.toPx(),
                    StrokeCap.Round,
                )
                drawLine(
                    color,
                    Offset(w * 0.68f, w * 0.08f),
                    Offset(w * 0.68f, w * 0.26f),
                    2.dp.toPx(),
                    StrokeCap.Round,
                )
            }
            DaybookTab.STATS -> {
                listOf(0.2f to 0.5f, 0.5f to 0.15f, 0.8f to 0.6f).forEach { (x, top) ->
                    drawLine(color, Offset(w * x, w * 0.88f), Offset(w * x, w * top), 2.5.dp.toPx(), StrokeCap.Round)
                }
            }
        }
    }
}
