import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import { motion } from "../../constants/motion";

const STAGGER_DELAY_MS = 50;

interface StaggeredFadeProps {
  index: number;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function StaggeredFade({ index, style, children }: StaggeredFadeProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.normal,
      delay: index * STAGGER_DELAY_MS,
      useNativeDriver: true,
    }).start();
  }, [index, opacity]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

interface FadeInProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function FadeIn({ style, children }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.fast,
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
