import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  allTags,
  countRemaining,
  filterByTag,
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
  const { todos, hydrated, addTodo, toggle, rename, remove, clearCompleted } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => allTags(todos), [todos]);
  const activeTag = tag && tags.includes(tag) ? tag : null;
  const visible = useMemo(
    () => sortTodos(filterByTag(filterTodos(todos, filter), activeTag)),
    [todos, filter, activeTag],
  );
  const remaining = countRemaining(todos);
  const hasCompleted = todos.length > remaining;

  return (
    <View style={styles.container}>
      <TodoForm onAdd={addTodo} existingTags={tags} />

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

      {tags.length > 0 && (
        <View style={styles.tags} accessibilityLabel="Filter by tag">
          {tags.map((option) => {
            const selected = activeTag === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setTag(selected ? null : option)}
                style={[styles.tag, selected && styles.tagSelected]}
              >
                <Text style={[styles.tagText, selected && styles.tagTextSelected]}>#{option}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!hydrated ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>
          {todos.length === 0
            ? "No todos yet. Add your first one above."
            : activeTag
              ? `No ${filter === "all" ? "" : `${filter} `}todos tagged #${activeTag}.`
              : `No ${filter} todos.`}
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
  container: { flex: 1, gap: 16 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  filters: { flexDirection: "row", gap: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagSelected: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  tagText: { fontSize: 12, color: colors.muted },
  tagTextSelected: { color: colors.card },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  filterSelected: { backgroundColor: colors.foreground },
  filterText: { fontSize: 14, textTransform: "capitalize", color: colors.foreground, opacity: 0.7 },
  filterTextSelected: { color: colors.card, opacity: 1 },
  clear: { fontSize: 14, color: colors.foreground, opacity: 0.7 },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 14, color: colors.muted },
  list: { gap: 8 },
  remaining: { fontSize: 12, color: colors.muted },
});
