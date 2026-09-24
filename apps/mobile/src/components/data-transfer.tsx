import { useState } from "react";
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import {
  exportFileName,
  exportTodosCsv,
  exportTodosJson,
  parseImportJson,
  type ImportMode,
  type ImportResult,
  type Todo,
} from "@todo/shared";
import { colors } from "../theme";

type DataTransferProps = {
  todos: readonly Todo[];
  onImport: (todos: readonly Todo[], mode: ImportMode) => void;
};

export function DataTransfer({ todos, onImport }: DataTransferProps) {
  const [importing, setImporting] = useState(false);
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function share(format: "json" | "csv") {
    const message = format === "json" ? exportTodosJson(todos) : exportTodosCsv(todos);
    try {
      await Share.share({ title: exportFileName(format), message });
    } catch {
      // user dismissed the share sheet
    }
  }

  function close() {
    setImporting(false);
    setRaw("");
    setPending(null);
  }

  function finish(mode: ImportMode) {
    if (!pending) return;
    onImport(pending.todos, mode);
    setStatus(`Imported ${pending.todos.length} ${pending.todos.length === 1 ? "todo" : "todos"} (${mode}).`);
    close();
  }

  const empty = todos.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={empty} onPress={() => share("json")}>
          <Text style={[styles.link, empty && styles.disabled]}>Export JSON</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={empty} onPress={() => share("csv")}>
          <Text style={[styles.link, empty && styles.disabled]}>Export CSV</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setImporting(true)}>
          <Text style={styles.link}>Import JSON…</Text>
        </Pressable>
        {status && <Text style={styles.status}>{status}</Text>}
      </View>

      <Modal visible={importing} animationType="slide" onRequestClose={close}>
        <View style={styles.modal}>
          <Text style={styles.heading}>Import todos</Text>
          <Text style={styles.hint}>Paste the contents of a todos JSON export.</Text>
          <TextInput
            multiline
            value={raw}
            onChangeText={(text) => {
              setRaw(text);
              setPending(null);
            }}
            accessibilityLabel="JSON to import"
            placeholder='{"version":1,"todos":[…]}'
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {pending && (
            <View style={styles.summary}>
              <Text style={styles.text}>
                Found {pending.todos.length} valid {pending.todos.length === 1 ? "todo" : "todos"}
                {pending.errors.length > 0 &&
                  ` and ${pending.errors.length} ${pending.errors.length === 1 ? "problem" : "problems"}`}
                .
              </Text>
              {pending.errors.slice(0, 5).map((error) => (
                <Text key={error} style={styles.error}>
                  • {error}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.row}>
            {pending ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending.todos.length === 0}
                  onPress={() => finish("merge")}
                  style={[styles.primary, pending.todos.length === 0 && styles.disabled]}
                >
                  <Text style={styles.primaryText}>Merge</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending.todos.length === 0}
                  onPress={() => finish("replace")}
                  style={[styles.secondary, pending.todos.length === 0 && styles.disabled]}
                >
                  <Text style={styles.text}>Replace</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={!raw.trim()}
                onPress={() => setPending(parseImportJson(raw))}
                style={[styles.primary, !raw.trim() && styles.disabled]}
              >
                <Text style={styles.primaryText}>Check</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={close}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  link: { fontSize: 12, color: colors.foreground, opacity: 0.7 },
  disabled: { opacity: 0.3 },
  status: { fontSize: 12, color: colors.muted },
  modal: { flex: 1, padding: 20, paddingTop: 60, gap: 12, backgroundColor: colors.background },
  heading: { fontSize: 20, fontWeight: "600", color: colors.foreground },
  hint: { fontSize: 13, color: colors.muted },
  input: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    fontSize: 13,
    fontFamily: "monospace",
    color: colors.foreground,
    textAlignVertical: "top",
  },
  summary: { gap: 4 },
  text: { fontSize: 14, color: colors.foreground },
  error: { fontSize: 12, color: "#b91c1c" },
  primary: { borderRadius: 10, backgroundColor: colors.foreground, paddingHorizontal: 14, paddingVertical: 8 },
  primaryText: { fontSize: 14, color: colors.background },
  secondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
