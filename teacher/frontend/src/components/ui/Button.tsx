import React, { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useAppTheme } from "../../constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const MIN_TOUCH = 44;

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
  const theme = useAppTheme();
  const { radius, spacing, typography, motion, semantic } = theme;
  const isDisabled = disabled || loading;
  const variantStyles: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: semantic.action.primary },
    secondary: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: semantic.action.primary,
    },
    ghost: { backgroundColor: "transparent" },
    danger: { backgroundColor: semantic.state.error },
  };

  const textVariantStyles: Record<Variant, TextStyle> = {
    primary: { color: semantic.text.onPrimary },
    secondary: { color: semantic.action.primary },
    ghost: { color: semantic.action.primary },
    danger: { color: semantic.text.onPrimary },
  };
  const webTransition =
    Platform.OS === "web"
      ? ({
          transitionDuration: `${motion.fast}ms`,
          transitionProperty: "transform, opacity",
          transitionTimingFunction: "ease-out",
        } as unknown as ViewStyle)
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed, focused }) => [
        {
          alignItems: "center",
          justifyContent: "center",
          minHeight: MIN_TOUCH,
          borderRadius: radius.button,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
        },
        variantStyles[variant],
        size === "sm" && { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: MIN_TOUCH },
        size === "lg" && { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minHeight: 52 },
        isDisabled && baseStyles.disabled,
        fullWidth && styles.fullWidth,
        webTransition,
        !isDisabled && pressed && baseStyles.pressed,
        !isDisabled && focused && {
          outlineWidth: 2,
          outlineColor: semantic.action.primary,
          outlineStyle: "solid",
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? semantic.text.onPrimary : semantic.action.primary}
        />
      ) : (
        <Text
          style={[
            size === "sm" ? typography.buttonSmall : typography.button,
            textVariantStyles[variant],
            isDisabled && { color: semantic.text.disabled },
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: "100%" },
});

const baseStyles = StyleSheet.create({
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
