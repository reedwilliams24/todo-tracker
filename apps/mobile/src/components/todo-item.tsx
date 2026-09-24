import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isValidTitle, subtaskProgress, type Todo } from "@todo/shared";
import { colors, priorityColors } from "../theme";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  onAddSubtask: (id: string, title: string) => void;
  onToggleSubtask: (id: string, subtaskId: string) => void;
  onRemoveSubtask: (id: string, subtaskId: string) => void;
};

export function TodoItem({
  todo,
  onToggle,
  onRename,
  onRemove,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const progress = subtaskProgress(todo);

  function submitSubtask() {
    if (!isValidTitle(subtaskTitle)) return;
    onAddSubtask(todo.id, subtaskTitle);
    setSubtaskTitle("");
  }
  const [draftTitle, setDraftTitle] = useState(todo.title);

  function commit() {
    if (isValidTitle(draftTitle) && draftTitle.trim() !== todo.title) {
      onRename(todo.id, draftTitle);
    } else {
      setDraftTitle(todo.title);
    }
    setEditing(false);
  }

  const priority = priorityColors[todo.priority];

  return (
    <View style={styles.card}>
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.completed }}
        accessibilityLabel={`Mark "${todo.title}" as ${todo.completed ? "active" : "complete"}`}
        onPress={() => onToggle(todo.id)}
        style={[styles.checkbox, todo.completed && styles.checkboxChecked]}
      >
        {todo.completed && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>

      {editing ? (
        <TextInput
          autoFocus
          value={draftTitle}
          onChangeText={setDraftTitle}
          onBlur={commit}
          onSubmitEditing={commit}
          accessibilityLabel="Edit title"
          style={styles.editInput}
        />
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.titleButton}>
          <Text numberOfLines={1} style={[styles.title, todo.completed && styles.titleDone]}>
            {todo.title}
          </Text>
        </Pressable>
      )}

      {todo.dueDate && <Text style={styles.dueDate}>{todo.dueDate}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} subtasks of "${todo.title}"`}
        onPress={() => setExpanded((open) => !open)}
        hitSlop={6}
        style={styles.progress}
      >
        <Text style={styles.progressText}>
          {progress.total > 0 ? `${progress.done}/${progress.total}` : "+"} {expanded ? "▾" : "▸"}
        </Text>
      </Pressable>

      <View style={[styles.badge, { backgroundColor: priority.bg }]}>
        <Text style={[styles.badgeText, { color: priority.text }]}>{todo.priority}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete "${todo.title}"`}
        onPress={() => onRemove(todo.id)}
        hitSlop={8}
        style={styles.delete}
      >
        <Text style={styles.deleteText}>×</Text>
      </Pressable>
    </View>

    {expanded && (
      <View style={styles.subtasks}>
        {todo.subtasks?.map((subtask) => (
          <View key={subtask.id} style={styles.subtaskRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: subtask.completed }}
              accessibilityLabel={`Mark subtask "${subtask.title}" as ${subtask.completed ? "active" : "complete"}`}
              onPress={() => onToggleSubtask(todo.id, subtask.id)}
              style={[styles.checkbox, styles.subCheckbox, subtask.completed && styles.checkboxChecked]}
            >
              {subtask.completed && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            <Text
              numberOfLines={1}
              style={[styles.subtaskTitle, subtask.completed && styles.titleDone]}
            >
              {subtask.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete subtask "${subtask.title}"`}
              onPress={() => onRemoveSubtask(todo.id, subtask.id)}
              hitSlop={8}
              style={styles.delete}
            >
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          value={subtaskTitle}
          onChangeText={setSubtaskTitle}
          onSubmitEditing={submitSubtask}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder="Add a subtask"
          placeholderTextColor={colors.muted}
          accessibilityLabel={`New subtask for "${todo.title}"`}
          style={styles.subtaskInput}
        />
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  progress: { borderRadius: 999, backgroundColor: colors.border, paddingHorizontal: 8, paddingVertical: 2 },
  progressText: { fontSize: 12, color: colors.foreground, fontVariant: ["tabular-nums"] },
  subtasks: { marginLeft: 30, gap: 6 },
  subtaskRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subCheckbox: { width: 16, height: 16 },
  subtaskTitle: { flex: 1, fontSize: 14, color: colors.foreground },
  subtaskInput: { fontSize: 14, paddingVertical: 4, color: colors.foreground },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.foreground },
  checkmark: { color: colors.card, fontSize: 12, lineHeight: 14 },
  titleButton: { flex: 1 },
  title: { fontSize: 16, color: colors.foreground },
  titleDone: { textDecorationLine: "line-through", opacity: 0.5 },
  editInput: { flex: 1, fontSize: 16, paddingVertical: 4, color: colors.foreground },
  dueDate: { fontSize: 12, color: colors.muted },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, textTransform: "capitalize" },
  delete: { paddingHorizontal: 6, paddingVertical: 2 },
  deleteText: { fontSize: 18, color: colors.muted },
});
