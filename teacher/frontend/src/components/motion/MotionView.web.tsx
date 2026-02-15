import React, { ReactNode } from "react";
import { motion as framerMotion } from "framer-motion";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { motion } from "../../constants/motion";

type MotionPreset = "none" | "fadeIn" | "fadeInUp" | "softScaleIn";

interface MotionViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  preset?: MotionPreset;
  delayMs?: number;
  durationMs?: number;
}

type FramerStyle = Record<string, string | number | undefined>;

function getPreset(preset: MotionPreset) {
  if (preset === "fadeIn") {
    return { initial: { opacity: 0 }, animate: { opacity: 1 } };
  }
  if (preset === "fadeInUp") {
    return { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
  }
  if (preset === "softScaleIn") {
    return { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 } };
  }
  return { initial: undefined, animate: undefined };
}

export function MotionView({
  children,
  style,
  preset = "fadeInUp",
  delayMs = 0,
  durationMs = motion.normal,
}: MotionViewProps) {
  const { initial, animate } = getPreset(preset);
  const flatStyle = StyleSheet.flatten(style) as FramerStyle;
  return (
    <framerMotion.div
      initial={initial}
      animate={animate}
      transition={{
        duration: durationMs / 1000,
        delay: delayMs / 1000,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={flatStyle}
    >
      {children}
    </framerMotion.div>
  );
}
