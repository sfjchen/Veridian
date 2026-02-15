import React, { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  descriptionSecondary?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  descriptionSecondary,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {descriptionSecondary ? <Text style={styles.descriptionSecondary}>{descriptionSecondary}</Text> : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="primary" style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  iconWrap: { marginBottom: spacing.lg },
  title: {
    ...typography.h2,
    color: palette.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: palette.textMuted,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  descriptionSecondary: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  button: { marginTop: spacing.md },
});
