import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isValidTitle, type Todo } from "@todo/shared";
import { colors, priorityColors } from "../theme";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
};

export function TodoItem({ todo, onToggle, onRename, onRemove }: TodoItemProps) {
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

      {todo.tags?.map((tag) => (
        <Text key={tag} style={styles.tag}>
          #{tag}
        </Text>
      ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
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
  tag: {
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dueDate: { fontSize: 12, color: colors.muted },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, textTransform: "capitalize" },
  delete: { paddingHorizontal: 6, paddingVertical: 2 },
  deleteText: { fontSize: 18, color: colors.muted },
});
