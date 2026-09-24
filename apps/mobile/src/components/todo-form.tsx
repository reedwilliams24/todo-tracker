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
import { borderWidth, colors, fontSize, fontWeight, radius, spacing } from "../theme";

const PRIORITIES: TodoPriority[] = ["low", "medium", "high"];

export function TodoForm({ onAdd }: { onAdd: (draft: TodoDraft) => void }) {
  const [form, setForm] = useState(EMPTY_TODO_FORM);
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

const styles = StyleSheet.create({
  card: {
    gap: spacing[2],
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing[3],
  },
  input: { fontSize: fontSize.base, paddingHorizontal: spacing[2], paddingVertical: spacing[2], color: colors.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  segments: {
    flexDirection: "row",
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  segment: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[1.5] },
  segmentSelected: { backgroundColor: colors.foreground },
  segmentText: { fontSize: fontSize.sm, textTransform: "capitalize", color: colors.foreground },
  segmentTextSelected: { color: colors.card },
  dateInput: {
    flex: 1,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  dateInvalid: { borderColor: colors.danger },
  addButton: {
    alignSelf: "flex-end",
    backgroundColor: colors.foreground,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  addText: { color: colors.card, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  disabled: { opacity: 0.4 },
});
