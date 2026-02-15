import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { palette, radius, elevation } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

export function PathSectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={18} color={palette.forestCanopy} />
      </View>
      <View style={styles.copyWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...elevation.shadowSm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.forestMist,
    justifyContent: "center",
    alignItems: "center",
  },
  copyWrap: {
    flex: 1,
  },
  title: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    marginTop: spacing.xxs,
  },
});
