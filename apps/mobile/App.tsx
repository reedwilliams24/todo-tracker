import { StatusBar } from "expo-status-bar";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TodoApp } from "./src/components/todo-app";
import { useT } from "./src/hooks/use-t";
import { colors, fontSize, fontWeight, spacing } from "./src/theme";

export default function App() {
  const t = useT();
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.main}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>{t("app.title")}</Text>
          <Text style={styles.subheading}>{t("app.tagline.mobile")}</Text>
        </View>
        <TodoApp />
      </KeyboardAvoidingView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0,
  },
  main: { flex: 1, padding: spacing[4], gap: spacing[4], maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { gap: spacing[1] },
  heading: { fontSize: fontSize["2xl"], fontWeight: fontWeight.semibold, color: colors.foreground },
  subheading: { fontSize: fontSize.sm, color: colors.muted },
});
