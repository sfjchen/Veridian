import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ForestBackground } from '@/components/forest';
import { palette } from '@/constants/palette';
import { useAuth } from '@/hooks/useAuth';
import { BackendHint } from '@/components/BackendHint';

export const unstable_settings = {
  anchor: '(tabs)',
};

const transparentTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};

function useProtectedRoute(userId: string | null, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onAuthScreen = segments[0] === 'sign-in' || segments[0] === 'sign-up';
    if (!userId && !onAuthScreen) {
      router.replace('/sign-in');
    } else if (userId && onAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [userId, loading, segments, router]);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caveat: require('@/assets/fonts/Caveat-Regular.ttf'),
  });
  const { userId, loading: authLoading } = useAuth();

  useProtectedRoute(userId, authLoading || !fontsLoaded);

  if (authLoading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={transparentTheme}>
        <View style={styles.root}>
          <ForestBackground />
          <View style={styles.content}>
            <BackendHint />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: "transparent" },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="assignments/[classroomId]"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="document/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="WorkspaceScreen" options={{ title: 'Workspace', headerShown: true }} />
              <Stack.Screen name="note/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ title: 'Sign in', headerShown: false }} />
              <Stack.Screen name="sign-up" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </View>
        </View>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
