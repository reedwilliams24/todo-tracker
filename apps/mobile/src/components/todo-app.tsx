import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  countCompleted,
  countRemaining,
  filterTodos,
  sortTodos,
  type TodoFilter,
} from "@todo/shared";
import { useTodos } from "../hooks/use-todos";
import { colors } from "../theme";
import { TodoForm } from "./todo-form";
import { TodoItem } from "./todo-item";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];

export function TodoApp() {
  const { todos, hydrated, addTodo, toggle, toggleMany, rename, remove, removeMany, clearCompleted } =
    useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visible = useMemo(() => sortTodos(filterTodos(todos, filter)), [todos, filter]);
  const remaining = countRemaining(todos);
  const completedCount = countCompleted(todos);
  const hasCompleted = completedCount > 0;

  const visibleIds = new Set(visible.map((todo) => todo.id));
  const selected = selectedIds.filter((id) => visibleIds.has(id));
  const allVisibleSelected = visible.length > 0 && selected.length === visible.length;

  function exitSelectMode() {
    setSelecting(false);
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function completeSelected() {
    toggleMany(selected);
    exitSelectMode();
  }

  function deleteSelected() {
    const n = selected.length;
    Alert.alert(`Delete ${n} ${n === 1 ? "todo" : "todos"}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeMany(selected);
          exitSelectMode();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <TodoForm onAdd={addTodo} />

      <View style={styles.toolbar}>
        <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel="Filter todos">
          {FILTERS.map((option) => {
            const selected = filter === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option)}
                style={[styles.filter, selected && styles.filterSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.toolbarRight}>
          {todos.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selecting }}
              onPress={() => (selecting ? exitSelectMode() : setSelecting(true))}
            >
              <Text style={styles.clear}>{selecting ? "Done" : "Select"}</Text>
            </Pressable>
          )}
          {hasCompleted && !selecting && (
            <Pressable accessibilityRole="button" onPress={clearCompleted}>
              <Text style={styles.clear}>Clear completed ({completedCount})</Text>
            </Pressable>
          )}
        </View>
      </View>

      {selecting && (
        <View style={styles.bulkBar} accessibilityLabel="Bulk actions">
          <Text style={styles.clear}>{selected.length} selected</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedIds(allVisibleSelected ? [] : visible.map((todo) => todo.id))}
          >
            <Text style={styles.bulkLink}>{allVisibleSelected ? "Select none" : "Select all"}</Text>
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            disabled={selected.length === 0}
            onPress={completeSelected}
            style={[styles.bulkButton, selected.length === 0 && styles.disabled]}
          >
            <Text style={styles.bulkButtonText}>Toggle complete</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={selected.length === 0}
            onPress={deleteSelected}
            style={[styles.bulkButton, styles.bulkDanger, selected.length === 0 && styles.disabled]}
          >
            <Text style={styles.bulkDangerText}>Delete</Text>
          </Pressable>
        </View>
      )}

      {!hydrated ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>
          {todos.length === 0 ? "No todos yet. Add your first one above." : `No ${filter} todos.`}
        </Text>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(todo) => todo.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TodoItem
              todo={item}
              onToggle={toggle}
              onRename={rename}
              onRemove={remove}
              selection={
                selecting ? { selected: selected.includes(item.id), onSelect: toggleSelected } : undefined
              }
            />
          )}
        />
      )}

      <Text style={styles.remaining}>
        {remaining} {remaining === 1 ? "task" : "tasks"} remaining
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  filters: { flexDirection: "row", gap: 4 },
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkLink: { fontSize: 14, color: colors.foreground },
  spacer: { flex: 1 },
  bulkButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bulkButtonText: { fontSize: 14, color: colors.foreground },
  bulkDanger: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  bulkDangerText: { fontSize: 14, color: "#fff" },
  disabled: { opacity: 0.4 },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  filterSelected: { backgroundColor: colors.foreground },
  filterText: { fontSize: 14, textTransform: "capitalize", color: colors.foreground, opacity: 0.7 },
  filterTextSelected: { color: colors.card, opacity: 1 },
  clear: { fontSize: 14, color: colors.foreground, opacity: 0.7 },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 14, color: colors.muted },
  list: { gap: 8 },
  remaining: { fontSize: 12, color: colors.muted },
});
