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
import { ThemeToggle } from "./src/components/theme-toggle";
import { ThemeProvider } from "./src/theme-provider";
import { useStyles, useTheme, type ThemeColors } from "./src/theme";

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const { theme } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.main}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.heading}>Todo Tracker</Text>
            <Text style={styles.subheading}>A tiny local-first todo list.</Text>
          </View>
          <ThemeToggle />
        </View>
        <TodoApp />
      </KeyboardAvoidingView>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0,
  },
  main: { flex: 1, padding: 16, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerText: { gap: 4 },
  heading: { fontSize: 24, fontWeight: "600", color: colors.foreground },
  subheading: { fontSize: 14, color: colors.muted },
});
