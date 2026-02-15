import React, { ReactNode } from "react";
import { Text, View, ViewStyle, TextStyle } from "react-native";
import { useAppTheme } from "../../constants/theme";

type BadgeVariant = "default" | "primary" | "muted";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const { spacing, typography, radius, semantic } = useAppTheme();
  const variantStyles: Record<BadgeVariant, ViewStyle> = {
    default: { backgroundColor: semantic.border.default },
    primary: { backgroundColor: semantic.action.primary },
    muted: { backgroundColor: semantic.bg.surface },
  };

  const textVariantStyles: Record<BadgeVariant, TextStyle> = {
    default: { color: semantic.text.secondary },
    primary: { color: semantic.text.onPrimary },
    muted: { color: semantic.text.muted },
  };

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.chip,
        alignSelf: "flex-start",
        ...variantStyles[variant],
      }}
    >
      <Text style={{ ...typography.caption, fontWeight: "600", ...textVariantStyles[variant] }}>{children}</Text>
    </View>
  );
}
