import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { countRemaining, filterTodos, sortTodos, SORTS, type TodoFilter } from "@todo/shared";
import { useSort } from "@todo/shared/react";
import { asyncSortStorage } from "../lib/storage";
import { useTodos } from "../hooks/use-todos";
import { colors } from "../theme";
import { TodoForm } from "./todo-form";
import { TodoItem } from "./todo-item";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];

export function TodoApp() {
  const { todos, hydrated, addTodo, toggle, rename, remove, reorder, clearCompleted } = useTodos();
  const [sort, setSort] = useSort(asyncSortStorage);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [liftedId, setLiftedId] = useState<string | null>(null);

  const visible = useMemo(() => sortTodos(filterTodos(todos, filter), sort), [todos, filter, sort]);

  function dropOn(targetId: string) {
    if (liftedId && liftedId !== targetId) {
      reorder(
        visible.map((todo) => todo.id),
        liftedId,
        targetId,
      );
      setSort("manual");
    }
    setLiftedId(null);
  }
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
        <View style={styles.toolbarRight}>
          <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Sort todos">
            {SORTS.map((option) => {
              const selected = sort === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSort(option)}
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
      </View>

      {liftedId && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Tap a todo to move the lifted one there.</Text>
          <Pressable accessibilityRole="button" onPress={() => setLiftedId(null)}>
            <Text style={styles.clear}>Cancel</Text>
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
              move={{
                lifted: liftedId === item.id,
                dropTarget: liftedId !== null && liftedId !== item.id,
                onLift: setLiftedId,
                onDrop: dropOn,
              }}
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
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  hintText: { fontSize: 12, color: colors.muted },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  filterSelected: { backgroundColor: colors.foreground },
  filterText: { fontSize: 14, textTransform: "capitalize", color: colors.foreground, opacity: 0.7 },
  filterTextSelected: { color: colors.card, opacity: 1 },
  clear: { fontSize: 14, color: colors.foreground, opacity: 0.7 },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 14, color: colors.muted },
  list: { gap: 8 },
  remaining: { fontSize: 12, color: colors.muted },
});
