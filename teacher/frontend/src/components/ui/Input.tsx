import React, { useState } from "react";
import { Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useAppTheme } from "../../constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, style, containerStyle, onFocus, onBlur, ...rest }: InputProps) {
  const theme = useAppTheme();
  const { radius, spacing, typography, semantic } = theme;
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? (
        <Text style={{ fontSize: 14, fontWeight: "600", color: semantic.text.secondary, marginBottom: spacing.xs }}>
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
      {error ? <Text style={{ fontSize: 12, marginTop: spacing.xxs, color: semantic.state.error }}>{error}</Text> : null}
    </View>
  );
}
