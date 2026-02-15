import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../constants/theme";

const TOAST_DURATION_MS = 3000;

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export function Toast({ message, visible, onHide }: ToastProps) {
  const { motion, spacing, typography, semantic } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.fast,
        useNativeDriver: true,
      }),
      Animated.delay(TOAST_DURATION_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: motion.fast,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  }, [visible, message, opacity, onHide, motion.fast]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.wrapper, { opacity, bottom: spacing.xl, left: spacing.lg, right: spacing.lg }]}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: semantic.state.successBg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: semantic.state.success,
        }}
      >
        <Text style={{ ...typography.bodySmall, color: semantic.state.success, fontWeight: "600" }}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    alignItems: "center",
    zIndex: 9999,
  },
});
