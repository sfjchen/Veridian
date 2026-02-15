import { type ReactNode, useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View, type ViewStyle } from "react-native";
import { elevation, palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, onPress, style }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const showHover = isWeb && onPress && hovered;

  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.92 : 1}
      onMouseEnter={isWeb && onPress ? () => setHovered(true) : undefined}
      onMouseLeave={isWeb && onPress ? () => setHovered(false) : undefined}
      style={[
        styles.card,
        elevation.shadowMd,
        showHover && styles.cardHover,
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  cardHover: {
    backgroundColor: palette.primaryMuted,
  },
});
