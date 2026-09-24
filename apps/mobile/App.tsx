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
import { colors } from "./src/theme";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.main}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Todo Tracker</Text>
          <Text style={styles.subheading}>A tiny local-first todo list.</Text>
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
  main: { flex: 1, padding: 16, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { gap: 4 },
  heading: { fontSize: 24, fontWeight: "600", color: colors.foreground },
  subheading: { fontSize: 14, color: colors.muted },
});
