import React, { ReactNode, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "../../constants/theme";

type CardRadius = "card" | "organic";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  radius?: CardRadius;
}

export function Card({ children, onPress, style, radius: radiusVariant = "card" }: CardProps): React.ReactElement {
  const theme = useAppTheme();
  const { elevation, radius, spacing, motion, semantic } = theme;
  const [hovered, setHovered] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isWeb = Platform.OS === "web";
  const showHover = isWeb && onPress && hovered;

  const handlePressIn = () => {
    if (onPress) {
      Animated.timing(scaleAnim, { toValue: 0.98, duration: motion.fast, useNativeDriver: true }).start();
    }
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
  };

  const cardRadius = radiusVariant === "organic" ? radius.organic : radius.card;

  const content = (
    <Animated.View
      style={[
        { backgroundColor: semantic.bg.card, padding: spacing.md },
        { borderRadius: cardRadius },
        elevation.shadowMd,
        showHover && { backgroundColor: semantic.bg.muted },
        style,
        onPress && { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onMouseEnter={isWeb ? () => setHovered(true) : undefined}
        onMouseLeave={isWeb ? () => setHovered(false) : undefined}
        style={styles.pressable}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  pressable: { alignSelf: "stretch" },
});
