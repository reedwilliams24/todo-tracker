import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { countRemaining, filterTodos, sortTodos, type TodoFilter } from "@todo/shared";
import { useTodos } from "../hooks/use-todos";
import { colors, fontSize, radius, spacing } from "../theme";
import { TodoForm } from "./todo-form";
import { TodoItem } from "./todo-item";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];

export function TodoApp() {
  const { todos, hydrated, addTodo, toggle, rename, remove, clearCompleted } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");

  const visible = useMemo(() => sortTodos(filterTodos(todos, filter)), [todos, filter]);
  const remaining = countRemaining(todos);
  const hasCompleted = todos.length > remaining;

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
        {hasCompleted && (
          <Pressable accessibilityRole="button" onPress={clearCompleted}>
            <Text style={styles.clear}>Clear completed</Text>
          </Pressable>
        )}
      </View>

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
            <TodoItem todo={item} onToggle={toggle} onRename={rename} onRemove={remove} />
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
  container: { flex: 1, gap: spacing[4] },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  filters: { flexDirection: "row", gap: spacing[1] },
  filter: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  filterSelected: { backgroundColor: colors.foreground },
  filterText: { fontSize: fontSize.sm, textTransform: "capitalize", color: colors.foreground, opacity: 0.7 },
  filterTextSelected: { color: colors.card, opacity: 1 },
  clear: { fontSize: fontSize.sm, color: colors.foreground, opacity: 0.7 },
  empty: { paddingVertical: spacing[10], textAlign: "center", fontSize: fontSize.sm, color: colors.muted },
  list: { gap: spacing[2] },
  remaining: { fontSize: fontSize.xs, color: colors.muted },
});
