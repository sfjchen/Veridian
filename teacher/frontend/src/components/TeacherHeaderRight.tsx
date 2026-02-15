import React from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../stores/auth";
import { palette } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

export function TeacherHeaderRight(): React.ReactElement {
  const { signOut } = useAuth();

  return (
    <TouchableOpacity
      onPress={signOut}
      style={styles.touchable}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Text style={styles.label}>Sign Out</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    minHeight: 44,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: palette.textSecondary,
  },
});
