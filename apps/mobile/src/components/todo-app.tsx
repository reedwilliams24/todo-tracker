import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { countRemaining, filterTodos, sortTodos, type TodoFilter } from "@todo/shared";
import { useT } from "../hooks/use-t";
import { useTodos } from "../hooks/use-todos";
import { colors } from "../theme";
import { TodoForm } from "./todo-form";
import { TodoItem } from "./todo-item";

const FILTERS: TodoFilter[] = ["all", "active", "completed"];

export function TodoApp() {
  const { todos, hydrated, addTodo, toggle, rename, remove, clearCompleted } = useTodos();
  const t = useT();
  const [filter, setFilter] = useState<TodoFilter>("all");

  const visible = useMemo(() => sortTodos(filterTodos(todos, filter)), [todos, filter]);
  const remaining = countRemaining(todos);
  const hasCompleted = todos.length > remaining;

  return (
    <View style={styles.container}>
      <TodoForm onAdd={addTodo} />

      <View style={styles.toolbar}>
        <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel={t("filter.label")}>
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
                  {t(`filter.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {hasCompleted && (
          <Pressable accessibilityRole="button" onPress={clearCompleted}>
            <Text style={styles.clear}>{t("list.clearCompleted")}</Text>
          </Pressable>
        )}
      </View>

      {!hydrated ? (
        <Text style={styles.empty}>{t("list.loading")}</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>
          {todos.length === 0
            ? t("list.empty")
            : t("list.emptyFiltered", { filter: t(`filter.${filter}`).toLowerCase() })}
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
        {t("list.remaining", { count: remaining })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  filters: { flexDirection: "row", gap: 4 },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  filterSelected: { backgroundColor: colors.foreground },
  filterText: { fontSize: 14, color: colors.foreground, opacity: 0.7 },
  filterTextSelected: { color: colors.card, opacity: 1 },
  clear: { fontSize: 14, color: colors.foreground, opacity: 0.7 },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 14, color: colors.muted },
  list: { gap: 8 },
  remaining: { fontSize: 12, color: colors.muted },
});
