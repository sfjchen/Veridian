import React, { ReactNode, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { elevation, palette, radius } from "../../constants/palette";
import { motion } from "../../constants/motion";
import { spacing } from "../../constants/spacing";

type CardRadius = "card" | "organic";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  radius?: CardRadius;
}

export function Card({ children, onPress, style, radius: radiusVariant = "card" }: CardProps): React.ReactElement {
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
        styles.card,
        { borderRadius: cardRadius },
        elevation.shadowMd,
        showHover && styles.cardHover,
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
  card: {
    backgroundColor: palette.card,
    padding: spacing.md,
  },
  cardHover: {
    backgroundColor: palette.primaryMutedTint,
  },
});
