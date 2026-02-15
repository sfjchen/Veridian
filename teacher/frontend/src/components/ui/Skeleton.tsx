import React, { useEffect, useRef, useState } from "react";
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from "react-native";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height = 20, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, useNativeDriver: true, duration: 600 }),
        Animated.timing(opacity, { toValue: 0.3, useNativeDriver: true, duration: 600 }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mounted, opacity]);

  const widthVal = (width ?? "100%") as DimensionValue;
  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: widthVal, height, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton height={20} style={{ marginBottom: spacing.xs }} />
      <Skeleton height={14} width="60%" />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: palette.border,
    borderRadius: radius.input,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
