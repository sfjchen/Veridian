import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface CopyableBadgeProps {
  text: string;
  onCopy?: () => void;
}

export function CopyableBadge({ text, onCopy }: CopyableBadgeProps): React.ReactElement {
  const handlePress = async (): Promise<void> => {
    await Clipboard.setStringAsync(text);
    onCopy?.();
  };

  return (
    <TouchableOpacity style={styles.badge} onPress={handlePress} activeOpacity={0.8}>
      <Text style={styles.code}>{text}</Text>
      <Text style={styles.copyLabel}> Copy</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
  },
  code: { ...typography.caption, fontWeight: "600", color: palette.textOnPrimary },
  copyLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginLeft: spacing.xxs,
  },
});
