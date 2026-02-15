import React, { ReactNode } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../constants/theme";
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
  const { spacing, typography, semantic } = useAppTheme();
  return (
    <View style={{ paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, alignItems: "center" }}>
      {icon ? <View style={{ marginBottom: spacing.lg }}>{icon}</View> : null}
      <Text style={{ ...typography.h2, color: semantic.text.primary, textAlign: "center", marginBottom: spacing.sm }}>
        {title}
      </Text>
      {description ? (
        <Text style={{ ...typography.bodySmall, color: semantic.text.muted, textAlign: "center", marginBottom: spacing.xs }}>
          {description}
        </Text>
      ) : null}
      {descriptionSecondary ? (
        <Text style={{ ...typography.caption, color: semantic.text.muted, textAlign: "center", marginBottom: spacing.lg }}>
          {descriptionSecondary}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="primary" style={{ marginTop: spacing.md }}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
