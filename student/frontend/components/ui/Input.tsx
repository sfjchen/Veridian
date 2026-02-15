import { useState } from "react";
import { Text, TextInput, type TextInputProps, View, type ViewStyle } from "react-native";
import { useAppTheme } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, style, containerStyle, onFocus, onBlur, ...rest }: InputProps) {
  const { radius, spacing, typography, semantic } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? (
        <Text style={{ ...typography.bodySmall, fontWeight: "600", color: semantic.text.secondary, marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={semantic.text.muted}
        style={[
          {
            borderWidth: 1,
            borderColor: semantic.border.input,
            borderRadius: radius.input,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            color: semantic.text.primary,
            minHeight: 44,
          },
          typography.body,
          error && { borderColor: semantic.state.error },
          !error && focused && { borderColor: semantic.action.primary },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? <Text style={{ fontSize: 12, color: semantic.state.error, marginTop: spacing.xxs }}>{error}</Text> : null}
    </View>
  );
}
