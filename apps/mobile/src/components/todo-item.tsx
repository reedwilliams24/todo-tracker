import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isValidTitle, type Todo } from "@todo/shared";
import { borderWidth, colors, fontSize, lineHeight, priorityColors, radius, spacing } from "../theme";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  /** Long-press lifts this row; tapping another row drops it there. */
  move?: { lifted: boolean; dropTarget: boolean; onLift: (id: string) => void; onDrop: (targetId: string) => void };
};

export function TodoItem({ todo, onToggle, onRename, onRemove, move }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
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
    <Pressable
      accessibilityLabel={move?.dropTarget ? `Move here, above "${todo.title}"` : undefined}
      onLongPress={move ? () => move.onLift(todo.id) : undefined}
      onPress={move?.dropTarget ? () => move.onDrop(todo.id) : undefined}
      delayLongPress={300}
      style={[styles.row, move?.lifted && styles.rowLifted, move?.dropTarget && styles.rowDropTarget]}
    >
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
        <Pressable
          onPress={move?.dropTarget ? () => move.onDrop(todo.id) : () => setEditing(true)}
          onLongPress={move ? () => move.onLift(todo.id) : undefined}
          delayLongPress={300}
          style={styles.titleButton}
        >
          <Text numberOfLines={1} style={[styles.title, todo.completed && styles.titleDone]}>
            {todo.title}
          </Text>
        </Pressable>
      )}

      {todo.dueDate && <Text style={styles.dueDate}>{todo.dueDate}</Text>}

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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2.5],
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rowLifted: { opacity: 0.5, borderColor: colors.foreground, borderStyle: "dashed" },
  rowDropTarget: { borderColor: colors.foreground },
  checkbox: {
    width: spacing[5],
    height: spacing[5],
    borderRadius: radius.sm,
    borderWidth: borderWidth.thick,
    borderColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.foreground },
  checkmark: { color: colors.card, fontSize: fontSize.xs, lineHeight: lineHeight.xs },
  titleButton: { flex: 1 },
  title: { fontSize: fontSize.base, color: colors.foreground },
  titleDone: { textDecorationLine: "line-through", opacity: 0.5 },
  editInput: { flex: 1, fontSize: fontSize.base, paddingVertical: spacing[1], color: colors.foreground },
  dueDate: { fontSize: fontSize.xs, color: colors.muted },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[0.5] },
  badgeText: { fontSize: fontSize.xs, textTransform: "capitalize" },
  delete: { paddingHorizontal: spacing[1.5], paddingVertical: spacing[0.5] },
  deleteText: { fontSize: fontSize.lg, color: colors.muted },
});
