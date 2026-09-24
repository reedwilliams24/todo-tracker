import { Pressable, StyleSheet, Text, View } from "react-native";
import { THEME_LABELS, THEME_PREFERENCES } from "@todo/shared";
import { useStyles, useTheme, type ThemeColors } from "../theme";

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Theme">
      {THEME_PREFERENCES.map((option) => {
        const selected = option === preference;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setPreference(option)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>
              {THEME_LABELS[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    group: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: "hidden",
    },
    segment: { paddingHorizontal: 10, paddingVertical: 6 },
    segmentSelected: { backgroundColor: colors.foreground },
    text: { fontSize: 12, color: colors.foreground, opacity: 0.7 },
    textSelected: { color: colors.card, opacity: 1 },
  });
