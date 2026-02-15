import React from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "../../constants/palette";
import { TreeIcon } from "../forest/TreeIcon";

const ICON_NAMES = {
  classroom: "school-outline",
  assignment: "note-text-outline",
  file: "file-document-outline",
  students: "account-group-outline",
  insights: "chart-line",
  settings: "cog-outline",
  forest: "forest",
} as const;

export type EmptyStateIconName = keyof typeof ICON_NAMES;

interface EmptyStateIconProps {
  name: EmptyStateIconName;
}

export function EmptyStateIcon({ name }: EmptyStateIconProps) {
  if (name === "forest") {
    return (
      <View style={styles.wrap}>
        <TreeIcon size={40} color={palette.primary} />
      </View>
    );
  }
  const iconName = ICON_NAMES[name];
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name={iconName as any} size={32} color={palette.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
  },
});
