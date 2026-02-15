import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, View, type ViewStyle } from "react-native";
import { useAppTheme } from "@/constants/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height = 20, style }: SkeletonProps) {
  const { radius, semantic } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, useNativeDriver: true, duration: 600 }),
        Animated.timing(opacity, { toValue: 0.3, useNativeDriver: true, duration: 600 }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const widthVal = (width ?? "100%") as DimensionValue;
  return (
    <Animated.View
      style={[{ width: widthVal, height, opacity, backgroundColor: semantic.border.default, borderRadius: radius.input }, style]}
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
