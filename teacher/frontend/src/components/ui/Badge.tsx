import React, { ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle, TextStyle } from "react-native";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

type BadgeVariant = "default" | "primary" | "muted";

const variantStyles: Record<BadgeVariant, ViewStyle> = {
  default: { backgroundColor: palette.border },
  primary: { backgroundColor: palette.primary },
  muted: { backgroundColor: palette.surface },
};

const textVariantStyles: Record<BadgeVariant, TextStyle> = {
  default: { color: palette.textSecondary },
  primary: { color: palette.textOnPrimary },
  muted: { color: palette.textMuted },
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <View style={[styles.badge, variantStyles[variant]]}>
      <Text style={[styles.text, textVariantStyles[variant]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
    alignSelf: "flex-start",
  },
  text: { ...typography.caption, fontWeight: "600" },
});
