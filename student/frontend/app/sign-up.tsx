import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSignUp = async () => {
    if (!supabase) {
      setError('Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
      return;
    }
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setError('Display name must be at least 2 characters');
      return;
    }
    if (trimmedName.length > 50) {
      setError('Display name is too long (max 50 characters)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role: 'student', display_name: displayName.trim() } },
      });
      if (err) throw err;
      if (!data.session) {
        setConfirmationSent(true);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.wordmark}>Veridian</Text>
            <Text style={styles.tagline}>Math, clearer.</Text>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a confirmation link to {email.trim()}. Open it to activate your account.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryLink, pressed && { opacity: 0.7 }]}
              onPress={() => router.replace('/sign-in')}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in">
              <Text style={styles.secondaryLinkText}>Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const canSubmit = !loading && displayName.trim() && email.trim() && password.length >= 6;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.wordmark}>Veridian</Text>
          <Text style={styles.tagline}>Math, clearer.</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Sign up with your school email to join classes.</Text>
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={palette.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={palette.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={palette.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && { opacity: 0.8 },
            ]}
            onPress={handleSignUp}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Sign up">
            {loading ? (
              <ActivityIndicator size="small" color={palette.textOnPrimary} />
            ) : (
              <Text style={styles.buttonText}>Sign up</Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryLink, pressed && { opacity: 0.7 }]}
            onPress={() => router.replace('/sign-in')}
            accessibilityRole="button"
            accessibilityLabel="Go to sign in">
            <Text style={styles.secondaryLinkText}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.primaryMutedTint },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  content: { alignItems: 'center' },
  wordmark: {
    ...typography.display,
    color: palette.primary,
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  tagline: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  subtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    ...typography.body,
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: palette.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    minHeight: 44,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.button, color: palette.textOnPrimary },
  secondaryLink: { marginTop: spacing.lg, padding: spacing.xs },
  secondaryLinkText: { ...typography.bodySmall, color: palette.link, textAlign: 'center' },
});
