import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette, radius } from '@/constants/palette';
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
        <View style={styles.content}>
          <MaterialCommunityIcons name="email-check-outline" size={64} color={palette.primary} />
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email.trim()}. Open it to activate your account.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
            onPress={() => router.replace('/sign-in')}
            accessibilityRole="button">
            <Text style={styles.backLinkText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canSubmit = !loading && displayName.trim() && email.trim() && password.length >= 6;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="account-plus-outline" size={64} color={palette.primary} />
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
          accessibilityRole="button">
          {loading ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.buttonText}>Sign up</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/sign-in')}
          accessibilityRole="button">
          <Text style={styles.backLinkText}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: palette.textPrimary, marginTop: 16 },
  subtitle: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    fontSize: 16,
    color: palette.textPrimary,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, color: palette.errorText, marginBottom: 12, textAlign: 'center' },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: palette.white },
  backLink: { marginTop: 20, padding: 8 },
  backLinkText: { fontSize: 15, color: palette.primary, fontWeight: '500' },
});
