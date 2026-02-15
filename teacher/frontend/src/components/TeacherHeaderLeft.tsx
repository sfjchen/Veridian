import React from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { palette } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { fontFamily, typography } from "../constants/typography";

const wordmarkStyle = {
  fontFamily: fontFamily.wordmark,
  fontSize: 22,
  color: palette.primary,
  textShadowColor: "rgba(22, 163, 74, 0.35)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
};

export function TeacherHeaderLeft(): React.ReactElement {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  if (canGoBack) {
    return (
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backTouchable}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wordmarkWrap}>
      <Text style={wordmarkStyle}>Veridian</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backTouchable: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    minHeight: 44,
  },
  backLabel: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: palette.primary,
  },
  wordmarkWrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    minHeight: 44,
  },
});
