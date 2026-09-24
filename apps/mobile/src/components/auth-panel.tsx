import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { useAuth } from "../hooks/use-auth";
import { colors } from "../theme";

type Props = ReturnType<typeof useAuth>;

export function AuthPanel({
  enabled,
  ready,
  user,
  sendEmailCode,
  verifyEmailCode,
  signInWithProvider,
  signOut,
}: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  if (!enabled || !ready) return null;

  const run = (action: Promise<void>, onDone?: () => void) => {
    setStatus(null);
    action.then(onDone).catch((error: Error) => setStatus(error.message));
  };

  if (user) {
    return (
      <View style={[styles.card, styles.row]}>
        <Text style={styles.muted} numberOfLines={1}>
          Signed in as {user.email ?? user.id} · syncs when online
        </Text>
        <Pressable accessibilityRole="button" onPress={() => run(signOut())}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.muted}>Sign in to sync across devices. Your local list comes with you.</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="Email"
        />
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => run(sendEmailCode(email.trim()), () => setCodeSent(true))}
        >
          <Text style={styles.primaryText}>{codeSent ? "Resend" : "Send code"}</Text>
        </Pressable>
      </View>
      {codeSent && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            accessibilityLabel="Sign-in code"
          />
          <Pressable
            accessibilityRole="button"
            style={styles.primary}
            onPress={() => run(verifyEmailCode(email.trim(), code.trim()))}
          >
            <Text style={styles.primaryText}>Verify</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          style={styles.secondary}
          onPress={() => run(signInWithProvider("google"))}
        >
          <Text style={styles.secondaryText}>Google</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.secondary}
          onPress={() => run(signInWithProvider("apple"))}
        >
          <Text style={styles.secondaryText}>Apple</Text>
        </Pressable>
      </View>
      {status && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">
          {status}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
  },
  primary: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.foreground },
  primaryText: { color: colors.background, fontWeight: "600" },
  secondary: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.foreground },
  muted: { flex: 1, color: colors.muted, fontSize: 13 },
  link: { color: colors.foreground, textDecorationLine: "underline" },
});
