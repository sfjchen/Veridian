import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

const TOAST_DURATION_MS = 3000;

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export function Toast({ message, visible, onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(TOAST_DURATION_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  }, [visible, message, opacity, onHide]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity }]} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    backgroundColor: palette.successBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.success,
  },
  text: {
    ...typography.bodySmall,
    color: palette.success,
    fontWeight: "600",
  },
});
