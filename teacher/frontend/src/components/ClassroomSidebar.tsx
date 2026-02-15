import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { palette, radius, elevation } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

export type ClassroomSection = "insights" | "assignments" | "corpus" | "students";
type GardenMood = "healthy" | "watch" | "critical";

type SectionOption = {
  key: ClassroomSection;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const SECTION_OPTIONS: SectionOption[] = [
  {
    key: "insights",
    label: "Insights",
    description: "Canopy health and growth",
    icon: "sprout",
  },
  {
    key: "assignments",
    label: "Assignments",
    description: "Plant and harvest work",
    icon: "book-open-page-variant-outline",
  },
  {
    key: "corpus",
    label: "Course Texts",
    description: "Nutrients and references",
    icon: "file-document-outline",
  },
  {
    key: "students",
    label: "Students",
    description: "Growth by learner",
    icon: "account-group-outline",
  },
];

export function ClassroomSidebar({
  activeSection,
  onChange,
  compact = false,
  badges,
  mood = "healthy",
}: {
  activeSection: ClassroomSection;
  onChange: (section: ClassroomSection) => void;
  compact?: boolean;
  badges?: Partial<Record<ClassroomSection, number>>;
  mood?: GardenMood;
}) {
  const moodLabel =
    mood === "healthy"
      ? "Garden is growing steadily"
      : mood === "watch"
        ? "Needs sunlight in some areas"
        : "Critical stress detected";

  return (
    <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
      <View style={[styles.moodBand, mood === "watch" && styles.moodBandWatch, mood === "critical" && styles.moodBandCritical]}>
        <MaterialCommunityIcons
          name={mood === "healthy" ? "leaf" : mood === "watch" ? "weather-sunset" : "alert-circle-outline"}
          size={14}
          color={mood === "healthy" ? palette.forestCanopy : mood === "watch" ? palette.warningText : palette.error}
        />
        <Text style={[styles.moodText, mood === "watch" && styles.moodTextWatch, mood === "critical" && styles.moodTextCritical]}>
          {moodLabel}
        </Text>
      </View>
      {SECTION_OPTIONS.map((option) => {
        const isActive = option.key === activeSection;
        const badgeValue = badges?.[option.key];
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.item, isActive && styles.itemActive]}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${option.label}`}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.itemTopRow}>
              <View style={styles.itemLabelRow}>
                <MaterialCommunityIcons
                  name={option.icon}
                  size={16}
                  color={isActive ? palette.forestCanopy : palette.textMuted}
                />
                <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{option.label}</Text>
              </View>
              {badgeValue !== undefined ? (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{badgeValue}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.itemDescription, isActive && styles.itemDescriptionActive]}>
              {option.description}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.sm,
    gap: spacing.xs,
    ...elevation.shadowSm,
  },
  sidebarCompact: {
    borderRadius: radius.card,
  },
  moodBand: {
    borderRadius: radius.input,
    backgroundColor: palette.forestMist,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
  },
  moodBandWatch: {
    backgroundColor: palette.warningBg,
    borderColor: "#FDE68A",
  },
  moodBandCritical: {
    backgroundColor: palette.errorBg,
    borderColor: "#FCA5A5",
  },
  moodText: {
    ...typography.caption,
    color: palette.forestCanopy,
    fontWeight: "600",
  },
  moodTextWatch: {
    color: palette.warningText,
  },
  moodTextCritical: {
    color: palette.error,
  },
  item: {
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "transparent",
    gap: spacing.xxs,
  },
  itemActive: {
    backgroundColor: palette.primaryMuted,
    borderColor: palette.forestLeaf,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  itemLabel: {
    ...typography.bodySmall,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  itemLabelActive: {
    color: palette.primary,
  },
  itemDescription: {
    ...typography.caption,
    color: palette.textMuted,
  },
  itemDescriptionActive: {
    color: palette.textSecondary,
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.chip,
    backgroundColor: palette.surface,
    alignItems: "center",
  },
  badgeActive: {
    backgroundColor: palette.forestCanopy,
  },
  badgeText: {
    ...typography.caption,
    color: palette.textMuted,
    fontWeight: "700",
  },
  badgeTextActive: {
    color: palette.textOnPrimary,
  },
});
