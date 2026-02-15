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

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!supabase) {
      setError('Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.title}>Sign in</Text>
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
            placeholder="Password"
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
              (loading || !email.trim() || !password) && styles.buttonDisabled,
              pressed && !loading && { opacity: 0.8 },
            ]}
            onPress={handleSignIn}
            disabled={loading || !email.trim() || !password}
            accessibilityRole="button"
            accessibilityLabel="Sign in">
            {loading ? (
              <ActivityIndicator size="small" color={palette.textOnPrimary} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryLink, pressed && { opacity: 0.7 }]}
            onPress={() => router.replace('/sign-up')}
            accessibilityRole="button"
            accessibilityLabel="Go to sign up">
            <Text style={styles.secondaryLinkText}>Don&apos;t have an account? Sign up</Text>
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
