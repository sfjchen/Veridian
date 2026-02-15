import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../../constants/theme";

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
  const { radius, spacing, typography, semantic } = useAppTheme();
  const [hovered, setHovered] = useState<string | null>(null);
  const isWeb = Platform.OS === "web";

  const renderTab = (opt: TabOption<T>) => {
    const isActive = value === opt.key;
    const showHover = isWeb && !isActive && hovered === opt.key;
    const pillStyle = scrollable
      ? {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.input,
          backgroundColor: semantic.border.default,
          alignItems: "center" as const,
        }
      : {
          flex: 1,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.input,
          backgroundColor: semantic.border.default,
          alignItems: "center" as const,
        };

    if (variant === "underline") {
      return (
        <TouchableOpacity
          key={opt.key}
          style={[
            { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
            isActive && { borderBottomColor: semantic.action.primary },
            showHover && styles.underlineTabHover,
          ]}
          onPress={() => onChange(opt.key)}
          onMouseEnter={isWeb ? () => setHovered(opt.key) : undefined}
          onMouseLeave={isWeb ? () => setHovered(null) : undefined}
          accessibilityRole="tab"
          accessibilityLabel={opt.label}
          accessibilityState={{ selected: isActive }}
        >
          <Text
            style={[
              { ...typography.bodySmall, fontWeight: "600", color: semantic.text.muted },
              isActive && { color: semantic.action.primary },
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={opt.key}
        style={[
          pillStyle,
          isActive && { backgroundColor: semantic.action.primary },
          showHover && { backgroundColor: semantic.border.strong },
        ]}
        onPress={() => onChange(opt.key)}
        onMouseEnter={isWeb ? () => setHovered(opt.key) : undefined}
        onMouseLeave={isWeb ? () => setHovered(null) : undefined}
        accessibilityRole="tab"
        accessibilityLabel={opt.label}
        accessibilityState={{ selected: isActive }}
      >
        <Text
          style={[
            { ...typography.bodySmall, fontWeight: "600", color: semantic.text.secondary },
            isActive && { color: semantic.text.onPrimary },
          ]}
        >
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const rowStyle = scrollable
    ? [{ flexDirection: "row" as const, gap: spacing.xs, alignItems: "center" as const }, styles.rowScrollable]
    : [{ flexDirection: "row" as const, gap: spacing.xs, alignItems: "center" as const }];

  const content = (
    <View style={rowStyle}>
      {options.map(renderTab)}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xxs }}>
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  rowScrollable: { flexGrow: 0 },
  underlineTabHover: { opacity: 0.8 },
});
