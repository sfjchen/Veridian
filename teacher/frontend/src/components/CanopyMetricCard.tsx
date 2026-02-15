import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette, radius, elevation } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

export function CanopyMetricCard({
  label,
  value,
  tone = "healthy",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "healthy" | "watch" | "critical";
  hint?: string;
}) {
  return (
    <View
      style={[
        styles.card,
        tone === "watch" && styles.cardWatch,
        tone === "critical" && styles.cardCritical,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 132,
    flex: 1,
    backgroundColor: palette.forestMist,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    padding: spacing.sm,
    ...elevation.shadowSm,
  },
  cardWatch: {
    backgroundColor: palette.warningBg,
    borderColor: "#FDE68A",
  },
  cardCritical: {
    backgroundColor: palette.errorBg,
    borderColor: "#FECACA",
  },
  label: {
    ...typography.caption,
    color: palette.textMuted,
    fontWeight: "700",
  },
  value: {
    ...typography.h2,
    color: palette.forestCanopy,
    marginTop: spacing.xxs,
  },
  hint: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
});
