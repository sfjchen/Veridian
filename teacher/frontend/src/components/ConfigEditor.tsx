import React from "react";
import { View, Text, Switch, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { AssignmentConfig } from "../types";

const DEFAULTS: AssignmentConfig = {
  check_button_visible: true,
  dot_threshold: "mechanical",
  max_dots_shown: 0,
  analysis_trigger: "auto_idle",
  analysis_debounce_seconds: 15,
  notification_style: "toast",
  chat_enabled: true,
  hint_level: "guided",
};

const ENUM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  dot_threshold: [
    { value: "notational", label: "Notational" },
    { value: "mechanical", label: "Mechanical" },
    { value: "procedural", label: "Procedural" },
    { value: "conceptual", label: "Conceptual" },
  ],
  analysis_trigger: [
    { value: "auto_idle", label: "Auto (idle)" },
    { value: "manual_only", label: "Manual" },
    { value: "passive", label: "Passive" },
  ],
  notification_style: [
    { value: "silent", label: "Silent" },
    { value: "toast", label: "Toast" },
    { value: "badge", label: "Badge" },
  ],
  hint_level: [
    { value: "guided", label: "Guided" },
    { value: "minimal", label: "Minimal" },
    { value: "detailed", label: "Detailed" },
  ],
};

const FIELD_LABELS: Record<string, string> = {
  check_button_visible: "Check Button Visible",
  dot_threshold: "Dot Threshold",
  max_dots_shown: "Max Dots Shown",
  analysis_trigger: "Analysis Trigger",
  analysis_debounce_seconds: "Debounce (seconds)",
  notification_style: "Notification Style",
  chat_enabled: "Chat Enabled",
  hint_level: "Hint Level",
};

const BOOL_FIELDS = ["check_button_visible", "chat_enabled"] as const;
const ENUM_FIELDS = ["dot_threshold", "analysis_trigger", "notification_style", "hint_level"] as const;
const INT_FIELDS = ["max_dots_shown", "analysis_debounce_seconds"] as const;

const FIELD_ORDER = [
  "check_button_visible",
  "chat_enabled",
  "hint_level",
  "analysis_trigger",
  "analysis_debounce_seconds",
  "dot_threshold",
  "max_dots_shown",
  "notification_style",
] as const;

interface Props {
  config: Partial<AssignmentConfig>;
  inheritedConfig?: AssignmentConfig;
  onChange: (config: Partial<AssignmentConfig>) => void;
  mode: "classroom" | "assignment";
}

function SegmentedControl({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={segStyles.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[segStyles.segment, selected === opt.value && segStyles.segmentActive]}
          onPress={() => onSelect(opt.value)}
          disabled={disabled}
        >
          <Text style={[segStyles.segmentText, selected === opt.value && segStyles.segmentTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  segment: {
    flex: 1, paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 6, backgroundColor: "#E5E7EB", alignItems: "center",
  },
  segmentActive: { backgroundColor: "#4F46E5" },
  segmentText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  segmentTextActive: { color: "#fff" },
});

export function ConfigEditor({ config, inheritedConfig, onChange, mode }: Props) {
  const resolved = inheritedConfig ?? DEFAULTS;

  const isOverridden = (key: string) => key in config;

  const toggleOverride = (key: string) => {
    if (isOverridden(key)) {
      const next = { ...config };
      delete next[key as keyof AssignmentConfig];
      onChange(next);
    } else {
      onChange({ ...config, [key]: resolved[key as keyof AssignmentConfig] });
    }
  };

  const setValue = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const getDisplayValue = (key: string) => {
    if (isOverridden(key)) return config[key as keyof AssignmentConfig];
    return resolved[key as keyof AssignmentConfig];
  };

  return (
    <View style={styles.container}>
      {FIELD_ORDER.map((key) => {
        const active = mode === "classroom" || isOverridden(key);
        const displayValue = getDisplayValue(key);

        return (
          <View key={key} style={[styles.fieldCard, !active && styles.fieldCardInactive]}>
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, !active && styles.fieldLabelInactive]}>
                {FIELD_LABELS[key]}
              </Text>
              {mode === "assignment" && (
                <TouchableOpacity
                  style={[styles.overrideChip, isOverridden(key) && styles.overrideChipActive]}
                  onPress={() => toggleOverride(key)}
                >
                  <Text style={[styles.overrideText, isOverridden(key) && styles.overrideTextActive]}>
                    {isOverridden(key) ? "Override" : "Inherit"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {(BOOL_FIELDS as readonly string[]).includes(key) && (
              <Switch
                value={displayValue as boolean}
                onValueChange={(v) => setValue(key, v)}
                disabled={!active}
                trackColor={{ true: "#4F46E5", false: "#D1D5DB" }}
              />
            )}

            {(ENUM_FIELDS as readonly string[]).includes(key) && ENUM_OPTIONS[key] && (
              <SegmentedControl
                options={ENUM_OPTIONS[key]}
                selected={displayValue as string}
                onSelect={(v) => setValue(key, v)}
                disabled={!active}
              />
            )}

            {(INT_FIELDS as readonly string[]).includes(key) && (
              <TextInput
                style={[styles.intInput, !active && styles.intInputInactive]}
                keyboardType="numeric"
                value={String(displayValue ?? "")}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  if (!isNaN(num)) setValue(key, num);
                  else if (text === "") setValue(key, 0);
                }}
                editable={active}
                placeholder={String(DEFAULTS[key as keyof AssignmentConfig])}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  fieldCard: {
    backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12,
  },
  fieldCardInactive: { opacity: 0.5 },
  fieldHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 8,
  },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  fieldLabelInactive: { color: "#9CA3AF" },
  overrideChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  overrideChipActive: { backgroundColor: "#4F46E5" },
  overrideText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  overrideTextActive: { color: "#fff" },
  intInput: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 6,
    padding: 8, fontSize: 14, backgroundColor: "#fff",
  },
  intInputInactive: { backgroundColor: "#F3F4F6", color: "#9CA3AF" },
});
