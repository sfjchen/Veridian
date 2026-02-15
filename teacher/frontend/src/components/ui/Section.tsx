import React, { ReactNode } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../constants/theme";

interface SectionProps {
  title?: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  const { spacing, typography, semantic } = useAppTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {title ? (
        <Text style={{ ...typography.h2, color: semantic.text.primary, marginBottom: spacing.sm }}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}
