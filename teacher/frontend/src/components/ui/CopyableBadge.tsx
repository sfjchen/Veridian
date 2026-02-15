import React from "react";
import { Text, TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAppTheme } from "../../constants/theme";

interface CopyableBadgeProps {
  text: string;
  onCopy?: () => void;
}

export function CopyableBadge({ text, onCopy }: CopyableBadgeProps): React.ReactElement {
  const { radius, spacing, typography, semantic } = useAppTheme();
  const handlePress = async (): Promise<void> => {
    await Clipboard.setStringAsync(text);
    onCopy?.();
  };

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: semantic.action.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.chip,
      }}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={{ ...typography.caption, fontWeight: "600", color: semantic.text.onPrimary }}>{text}</Text>
      <Text style={{ ...typography.caption, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginLeft: spacing.xxs }}>
        {" "}
        Copy
      </Text>
    </TouchableOpacity>
  );
}
