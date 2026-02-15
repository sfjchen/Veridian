import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../stores/auth";
import { alert } from "../../lib/alert";
import { Button, Card, Input, ScreenContainer } from "../../components/ui";
import { TreeIcon } from "../../components/forest";
import { elevation, palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Login">;
};

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      alert("Validation Error", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      alert("Login Failed", e instanceof Error ? e.message : "Sign in failed");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert("Email Required", "Enter your email above, then tap Forgot Password.");
      return;
    }
    try {
      await resetPassword(email.trim());
      alert("Check Your Email", "A password reset link has been sent to your email.");
    } catch (e: unknown) {
      alert("Reset Failed", e instanceof Error ? e.message : "Reset failed");
    }
  };

  return (
    <ScreenContainer maxWidth="form">
      <LinearGradient colors={[palette.forestMist, palette.surface]} style={styles.gradientBg}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Card style={StyleSheet.flatten([styles.card, elevation.shadowMd])}>
          <View style={styles.brandWrap}>
            <TreeIcon size={36} color={palette.primary} />
          </View>
          <Text style={styles.wordmark}>Veridian</Text>
          <Text style={styles.tagline}>Math, clearer. Where learning grows.</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Button onPress={handleLogin} loading={loading} fullWidth style={styles.button} accessibilityLabel="Sign In">
            Sign In
          </Button>
          <TouchableOpacity onPress={handleForgotPassword} style={styles.linkWrap} accessibilityLabel="Forgot password">
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Signup")} style={styles.linkWrap} accessibilityLabel="Go to sign up">
            <Text style={styles.link}>Don&apos;t have an account? Sign Up</Text>
          </TouchableOpacity>
        </Card>
        </ScrollView>
      </LinearGradient>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  card: { padding: spacing.lg, borderRadius: radius.organic },
  brandWrap: { alignItems: "center", marginBottom: spacing.sm },
  wordmark: {
    ...typography.display,
    color: palette.primary,
    textAlign: "center",
    marginBottom: spacing.xxs,
  },
  tagline: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  button: { marginTop: spacing.xs, marginBottom: spacing.sm },
  linkWrap: { alignSelf: "center", marginTop: spacing.xs },
  link: {
    ...typography.bodySmall,
    color: palette.link,
    textAlign: "center",
  },
});
