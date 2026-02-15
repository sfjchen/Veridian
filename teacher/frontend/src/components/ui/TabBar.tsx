import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export type TabBarVariant = "pill" | "underline";

export interface TabOption<T extends string> {
  key: T;
  label: string;
}

interface TabBarProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  variant?: TabBarVariant;
  scrollable?: boolean;
}

export function TabBar<T extends string>({
  options,
  value,
  onChange,
  variant = "pill",
  scrollable = false,
}: TabBarProps<T>) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isWeb = Platform.OS === "web";

  const renderTab = (opt: TabOption<T>) => {
    const isActive = value === opt.key;
    const showHover = isWeb && !isActive && hovered === opt.key;
    const pillStyle = scrollable ? styles.pillTabScrollable : styles.pillTab;

    if (variant === "underline") {
      return (
        <TouchableOpacity
          key={opt.key}
          style={[styles.underlineTab, isActive && styles.underlineTabActive, showHover && styles.underlineTabHover]}
          onPress={() => onChange(opt.key)}
          onMouseEnter={isWeb ? () => setHovered(opt.key) : undefined}
          onMouseLeave={isWeb ? () => setHovered(null) : undefined}
          accessibilityRole="tab"
          accessibilityLabel={opt.label}
          accessibilityState={{ selected: isActive }}
        >
          <Text style={[styles.underlineTabText, isActive && styles.underlineTabTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={opt.key}
        style={[pillStyle, isActive && styles.pillTabActive, showHover && styles.pillTabHover]}
        onPress={() => onChange(opt.key)}
        onMouseEnter={isWeb ? () => setHovered(opt.key) : undefined}
        onMouseLeave={isWeb ? () => setHovered(null) : undefined}
        accessibilityRole="tab"
        accessibilityLabel={opt.label}
        accessibilityState={{ selected: isActive }}
      >
        <Text style={[styles.pillTabText, isActive && styles.pillTabTextActive]}>{opt.label}</Text>
      </TouchableOpacity>
    );
  };

  const rowStyle = scrollable ? [styles.row, styles.rowScrollable] : styles.row;

  const content = (
    <View style={rowStyle}>
      {options.map(renderTab)}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" as const, gap: spacing.xs, alignItems: "center" as const },
  rowScrollable: { flexGrow: 0 },
  scrollContent: { paddingVertical: spacing.xxs },
  pillTab: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.input, backgroundColor: palette.border, alignItems: "center" as const },
  pillTabScrollable: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.input, backgroundColor: palette.border, alignItems: "center" as const },
  pillTabActive: { backgroundColor: palette.primary },
  pillTabHover: { backgroundColor: palette.borderStrong },
  pillTabText: { ...typography.bodySmall, fontWeight: "600" as const, color: palette.textSecondary },
  pillTabTextActive: { color: palette.white },
  underlineTab: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  underlineTabActive: { borderBottomColor: palette.primary },
  underlineTabHover: { opacity: 0.8 },
  underlineTabText: { ...typography.bodySmall, fontWeight: "600" as const, color: palette.textMuted },
  underlineTabTextActive: { color: palette.primary },
});
