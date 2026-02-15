import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette } from "@/constants/palette";
import { spacing } from "@/constants/spacing";

type MaxWidth = "form" | "dashboard" | "full";

const MAX_WIDTH: Record<MaxWidth, number> = {
  form: 720,
  dashboard: 960,
  full: 9999,
};

interface ScreenContainerProps {
  children: ReactNode;
  maxWidth?: MaxWidth;
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export function ScreenContainer({
  children,
  maxWidth = "full",
  edges = ["top", "left", "right"],
}: ScreenContainerProps) {
  const content = (
    <View style={[styles.inner, maxWidth !== "full" && styles.centered]}>
      <View style={[styles.content, maxWidth !== "full" && { maxWidth: MAX_WIDTH[maxWidth] }]}>
        {children}
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return <View style={styles.webRoot}>{content}</View>;
  }
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface },
  webRoot: { flex: 1, backgroundColor: palette.surface },
  inner: { flex: 1, paddingHorizontal: spacing.md },
  centered: { alignItems: "center" as const },
  content: { flex: 1, width: "100%" },
});
