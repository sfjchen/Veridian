import React, { useEffect, useRef, useState } from "react";
import { Animated, DimensionValue, View, ViewStyle } from "react-native";
import { useAppTheme } from "../../constants/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height = 20, style }: SkeletonProps) {
  const { radius, motion, semantic } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, useNativeDriver: true, duration: motion.slow }),
        Animated.timing(opacity, { toValue: 0.3, useNativeDriver: true, duration: motion.slow }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mounted, opacity, motion.slow]);

  const widthVal = (width ?? "100%") as DimensionValue;
  return (
    <Animated.View
      style={[
        { width: widthVal, height, opacity, backgroundColor: semantic.border.default, borderRadius: radius.input },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const { radius, spacing, semantic } = useAppTheme();
  return (
    <View style={{ backgroundColor: semantic.bg.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.sm }}>
      <Skeleton height={20} style={{ marginBottom: spacing.xs }} />
      <Skeleton height={14} width="60%" />
    </View>
  );
}