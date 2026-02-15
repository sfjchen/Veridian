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
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="account-circle-outline" size={64} color={palette.primary} />
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Use your student account to see classes and assignments.</Text>
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
          accessibilityRole="button">
          {loading ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/sign-up')}
          accessibilityRole="button">
          <Text style={styles.backLinkText}>Don't have an account? Sign up</Text>
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
