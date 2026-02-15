import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { Button } from "./Button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button onPress={onRetry} variant="primary" size="sm" style={styles.button} accessibilityLabel="Retry">
          Retry
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: "center",
  },
  message: {
    ...typography.body,
    color: palette.error,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  button: { marginTop: spacing.xs },
});
