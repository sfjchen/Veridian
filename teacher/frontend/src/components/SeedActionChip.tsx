import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { palette, radius } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

export function SeedActionChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={14} color={palette.forestCanopy} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    backgroundColor: palette.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.forestMist,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "700",
  },
});
