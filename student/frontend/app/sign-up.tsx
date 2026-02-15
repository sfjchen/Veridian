import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Input, ScreenContainer } from "@/components/ui";
import { palette } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { supabase } from "@/lib/supabase";

export default function SignUpScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSignUp = async () => {
    if (!supabase) {
      setError(
        "Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
      );
      return;
    }
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setError("Display name must be at least 2 characters");
      return;
    }
    if (trimmedName.length > 50) {
      setError("Display name is too long (max 50 characters)");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role: "student", display_name: displayName.trim() } },
      });
      if (err) throw err;
      if (!data.session) {
        setConfirmationSent(true);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <ScreenContainer maxWidth="form">
        <View style={styles.content}>
          <MaterialCommunityIcons name="email-check-outline" size={64} color={palette.primary} />
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email.trim()}. Open it to activate your account.
          </Text>
          <Button variant="ghost" onPress={() => router.replace("/sign-in")} style={styles.backLink}>
            Back to sign in
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  const canSubmit =
    !loading && !!displayName.trim() && !!email.trim() && password.length >= 6;

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.content}>
        <MaterialCommunityIcons name="account-plus-outline" size={64} color={palette.primary} />
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Sign up with your school email to join classes.</Text>
        <Card style={styles.card}>
          <Input
            label="Display name"
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
            containerStyle={styles.inputWrap}
          />
          <Input
            label="Email"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
            containerStyle={styles.inputWrap}
          />
          <Input
            label="Password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            error={error ?? undefined}
            containerStyle={styles.inputWrap}
          />
          <Button
            onPress={handleSignUp}
            loading={loading}
            disabled={!canSubmit}
            fullWidth
            style={styles.button}
          >
            Sign up
          </Button>
        </Card>
        <Button variant="ghost" onPress={() => router.replace("/sign-in")} style={styles.backLink}>
          Already have an account? Sign in
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  card: { width: "100%", marginBottom: spacing.md },
  inputWrap: { marginBottom: spacing.sm },
  button: { marginTop: spacing.xs },
  backLink: { marginTop: spacing.lg },
});
