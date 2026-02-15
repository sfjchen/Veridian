import React, { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface SectionProps {
  title?: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  title: {
    ...typography.h2,
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
});
