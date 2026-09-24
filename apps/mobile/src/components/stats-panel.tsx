import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { computeStats, type Todo } from "@todo/shared";
import { colors } from "../theme";

export function StatsPanel({ todos }: { todos: readonly Todo[] }) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => (open ? computeStats(todos) : undefined), [open, todos]);
  const max = stats ? Math.max(1, ...stats.perDay.map((d) => d.count)) : 1;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.header}
      >
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.toggle}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {stats && (
        <View style={styles.body}>
          <View style={styles.metrics}>
            <Metric label="Completed" value={String(stats.totalCompleted)} />
            <Metric label="Current streak" value={`${stats.currentStreak}d`} />
            <Metric label="Longest streak" value={`${stats.longestStreak}d`} />
          </View>
          <View style={styles.chart} accessibilityLabel="Completed per day, last 30 days">
            {stats.perDay.map((day) => (
              <View
                key={day.date}
                accessibilityLabel={`${day.date}: ${day.count} completed`}
                style={[
                  styles.bar,
                  { height: `${Math.max(day.count > 0 ? 8 : 2, (day.count / max) * 100)}%` },
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 14, fontWeight: "500", color: colors.foreground },
  toggle: { fontSize: 14, color: colors.muted },
  body: { marginTop: 12, gap: 12 },
  metrics: { flexDirection: "row", justifyContent: "space-around" },
  metric: { alignItems: "center" },
  metricLabel: { fontSize: 12, color: colors.muted },
  metricValue: { fontSize: 18, fontWeight: "600", color: colors.foreground },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 64, gap: 1 },
  bar: { flex: 1, backgroundColor: colors.foreground, opacity: 0.7, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
