import React from "react";
import { AuthProvider } from "./src/stores/auth";
import { RootNavigator } from "./src/navigation";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
