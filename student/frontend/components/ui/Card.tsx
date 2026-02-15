import { type ReactNode, useState } from "react";
import { Platform, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useAppTheme } from "@/constants/theme";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, onPress, style }: CardProps) {
  const { elevation, radius, spacing, semantic } = useAppTheme();
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const showHover = isWeb && onPress && hovered;

  const webProps = isWeb && onPress ? {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  } : {};

  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.92 : 1}
      {...webProps}
      style={[
        {
          backgroundColor: semantic.bg.card,
          borderRadius: radius.card,
          padding: spacing.md,
        },
        elevation.shadowMd,
        showHover && { backgroundColor: semantic.bg.muted },
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}
