import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { palette, radius, typography } from "../constants/palette";

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>We couldn’t load this screen. Try again.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: palette.surface,
  },
  title: { ...typography.h1, color: palette.textPrimary, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 16, color: palette.textMuted, marginBottom: 24, textAlign: "center" },
  button: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
});
