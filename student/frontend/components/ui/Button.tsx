import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const MIN_TOUCH = 44;

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: palette.primary },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: palette.primary,
  },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: palette.error },
};

const textVariantStyles: Record<Variant, TextStyle> = {
  primary: { color: palette.textOnPrimary },
  secondary: { color: palette.primary },
  ghost: { color: palette.primary },
  danger: { color: palette.textOnPrimary },
};

interface ButtonProps {
  onPress: () => void;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
  fullWidth,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        size === "sm" && styles.sizeSm,
        size === "lg" && styles.sizeLg,
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        !isDisabled && pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? palette.textOnPrimary : palette.primary}
        />
      ) : (
        <Text
          style={[
            size === "sm" ? typography.buttonSmall : typography.button,
            textVariantStyles[variant],
            isDisabled && styles.textDisabled,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TOUCH,
  },
  sizeSm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 36 },
  sizeLg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minHeight: 52 },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  textDisabled: { color: palette.textDisabled },
});
