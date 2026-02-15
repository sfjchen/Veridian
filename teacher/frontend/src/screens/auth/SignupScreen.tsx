import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../stores/auth";
import { UserRole } from "../../types";
import { alert } from "../../lib/alert";
import { Button, Card, Input, Row, ScreenContainer } from "../../components/ui";
import { elevation, palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Signup">;
};

export function SignupScreen({ navigation }: SignupScreenProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!displayName.trim() || !email.trim() || !password) {
      alert("Validation Error", "Please fill in all fields.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      alert("Weak Password", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, role, displayName.trim());
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("check your email")) {
        alert("Account Created", e.message);
        navigation.navigate("Login");
      } else {
        alert("Signup Failed", e instanceof Error ? e.message : "Sign up failed");
      }
      setLoading(false);
    }
  };

  return (
    <ScreenContainer maxWidth="form">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={StyleSheet.flatten([styles.card, elevation.shadowMd])}>
          <Text style={styles.wordmark}>Veridian</Text>
          <Text style={styles.tagline}>Math, clearer.</Text>
          <Text style={styles.title}>Create Account</Text>
          <Input
            placeholder="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
          />
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
            autoComplete="password-new"
          />
          <Text style={styles.roleLabel}>I am a:</Text>
          <Row gap={spacing.sm} style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleButton, role === "student" && styles.roleActive]}
              onPress={() => setRole("student")}
            >
              <Text style={[styles.roleText, role === "student" && styles.roleTextActive]}>
                Student
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, role === "teacher" && styles.roleActive]}
              onPress={() => setRole("teacher")}
            >
              <Text style={[styles.roleText, role === "teacher" && styles.roleTextActive]}>
                Teacher
              </Text>
            </TouchableOpacity>
          </Row>
          <Button onPress={handleSignup} loading={loading} fullWidth style={styles.button}>
            Sign Up
          </Button>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.linkWrap}>
            <Text style={styles.link}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.primaryMutedTint,
  },
  card: { padding: spacing.lg },
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
    marginBottom: spacing.lg,
  },
  roleLabel: {
    ...typography.body,
    fontWeight: "600",
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  roleRow: { marginBottom: spacing.md },
  roleButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: radius.input,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  roleActive: { borderColor: palette.primary, backgroundColor: palette.successBg },
  roleText: { ...typography.body, color: palette.textMuted },
  roleTextActive: { color: palette.primary, fontWeight: "600" },
  button: { marginBottom: spacing.sm },
  linkWrap: { alignSelf: "center", marginTop: spacing.xs },
  link: { ...typography.bodySmall, color: palette.link, textAlign: "center" },
});
