import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Input, ScreenContainer } from "@/components/ui";
import { palette } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!supabase) {
      setError(
        "Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.content}>
        <MaterialCommunityIcons name="school-outline" size={64} color={palette.primary} />
        <Text style={styles.title}>Welcome to Veridian!</Text>
        <Text style={styles.subtitle}>Sign in with your student account to get started.</Text>
        <Card style={styles.card}>
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
            accessibilityLabel="Email"
          />
          <Input
            label="Password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            error={error ?? undefined}
            containerStyle={styles.inputWrap}
            accessibilityLabel="Password"
          />
          <Button
            onPress={handleSignIn}
            loading={loading}
            disabled={!email.trim() || !password}
            fullWidth
            style={styles.button}
            accessibilityLabel="Sign in"
          >
            Sign in
          </Button>
        </Card>
        <Button variant="ghost" onPress={() => router.replace("/sign-up")} style={styles.backLink} accessibilityLabel="Go to sign up">
          Do not have an account? Sign up
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
