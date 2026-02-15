import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../constants/theme";
import { Button } from "./Button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { spacing, typography, semantic } = useAppTheme();
  return (
    <View style={{ padding: spacing.lg, alignItems: "center" }}>
      <Text style={{ ...typography.body, color: semantic.state.error, textAlign: "center", marginBottom: spacing.sm }}>
        {message}
      </Text>
      {onRetry ? (
        <Button onPress={onRetry} variant="primary" size="sm" style={{ marginTop: spacing.xs }} accessibilityLabel="Retry">
          Retry
        </Button>
      ) : null}
    </View>
  );
}
