import React from "react";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DancingScript_600SemiBold } from "@expo-google-fonts/dancing-script";
import { AuthProvider } from "./src/stores/auth";
import { ToastProvider } from "./src/contexts/ToastContext";
import { RootNavigator } from "./src/navigation";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DancingScript_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
