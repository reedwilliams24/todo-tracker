import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  EMPTY_TODO_FORM,
  isValidDueDate,
  isValidTitle,
  toTodoDraft,
  type TodoDraft,
  type TodoPriority,
} from "@todo/shared";
import { useStyles, useTheme, type ThemeColors } from "../theme";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { title, priority, dueDate } = form;

  const dateOk = isValidDueDate(dueDate);
  const canAdd = isValidTitle(title) && dateOk;

  function submit() {
    if (!canAdd) return;
    onAdd(toTodoDraft(form));
    setForm(EMPTY_TODO_FORM);
  }

  return (
    <View style={styles.card}>
      <TextInput
        value={title}
        onChangeText={(value) => setForm((f) => ({ ...f, title: value }))}
        placeholder="What needs doing?"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Todo title"
        onSubmitEditing={submit}
        returnKeyType="done"
        style={styles.input}
      />
      <View style={styles.row}>
        <View style={styles.segments} accessibilityLabel="Priority" accessibilityRole="radiogroup">
          {PRIORITIES.map((option) => {
            const selected = option === priority;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setForm((f) => ({ ...f, priority: option }))}
                style={[styles.segment, selected && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={dueDate}
          onChangeText={(value) => setForm((f) => ({ ...f, dueDate: value }))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Due date"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          style={[styles.dateInput, !dateOk && styles.dateInvalid]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!canAdd}
        onPress={submit}
        style={[styles.addButton, !canAdd && styles.disabled]}
      >
        <Text style={styles.addText}>Add</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  input: { fontSize: 16, paddingHorizontal: 8, paddingVertical: 8, color: colors.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  segments: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  segment: { paddingHorizontal: 10, paddingVertical: 6 },
  segmentSelected: { backgroundColor: colors.foreground },
  segmentText: { fontSize: 13, textTransform: "capitalize", color: colors.foreground },
  segmentTextSelected: { color: colors.card },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.foreground,
  },
  dateInvalid: { borderColor: colors.danger },
  addButton: {
    alignSelf: "flex-end",
    backgroundColor: colors.foreground,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addText: { color: colors.card, fontSize: 14, fontWeight: "500" },
  disabled: { opacity: 0.4 },
});
