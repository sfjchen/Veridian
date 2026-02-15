import React from "react";
import { AuthProvider } from "./src/stores/auth";
import { RootNavigator } from "./src/navigation";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
