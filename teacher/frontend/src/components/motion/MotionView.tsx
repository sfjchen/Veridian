import React, { ReactNode } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

type MotionPreset = "none" | "fadeIn" | "fadeInUp" | "softScaleIn";

interface MotionViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  preset?: MotionPreset;
  delayMs?: number;
  durationMs?: number;
}

export function MotionView({ children, style }: MotionViewProps) {
  return <View style={style}>{children}</View>;
}
