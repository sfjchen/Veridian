import React, { useState } from "react";
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
  student_mistake_visibility: false,
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
  analysis_debounce_seconds: "Analysis Debounce (seconds)",
  notification_style: "Notification Style",
  chat_enabled: "Chat Enabled",
  hint_level: "Hint Level",
  student_mistake_visibility: "Student Mistake Visibility",
};

const BOOL_FIELDS = ["check_button_visible", "chat_enabled", "student_mistake_visibility"] as const;
const ENUM_FIELDS = ["dot_threshold", "analysis_trigger", "notification_style", "hint_level"] as const;
const INT_FIELDS = ["max_dots_shown", "analysis_debounce_seconds"] as const;

const INT_RANGES: Record<string, { min: number; max: number }> = {
  max_dots_shown: { min: 0, max: 50 },
  analysis_debounce_seconds: { min: 1, max: 300 },
};

const FIELD_ORDER = [
  "check_button_visible",
  "chat_enabled",
  "hint_level",
  "analysis_trigger",
  "analysis_debounce_seconds",
  "dot_threshold",
  "max_dots_shown",
  "notification_style",
  "student_mistake_visibility",
] as const;

interface Props {
  config: Partial<AssignmentConfig>;
  inheritedConfig?: Partial<AssignmentConfig>;
  onChange: (config: Partial<AssignmentConfig>) => void;
  mode: "classroom" | "assignment";
}

function SegmentedControl({ options, selected, onSelect, disabled }: {
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

function getIntValidationError(key: string, value: number): string | null {
  const range = INT_RANGES[key];
  if (!range) return null;
  if (value < range.min || value > range.max) return `Must be ${range.min}..${range.max}`;
  return null;
}

function OverrideChip({ overridden, onPress }: { overridden: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.overrideChip, overridden && styles.overrideChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.overrideText, overridden && styles.overrideTextActive]}>
        {overridden ? "Override" : "Inherit"}
      </Text>
    </TouchableOpacity>
  );
}

function FieldHeader({ label, active, mode, overridden, onToggle }: {
  label: string; active: boolean; mode: "classroom" | "assignment";
  overridden: boolean; onToggle: () => void;
}) {
  return (
    <View style={styles.fieldHeader}>
      <Text style={[styles.fieldLabel, !active && styles.fieldLabelInactive]}>{label}</Text>
      {mode === "assignment" && <OverrideChip overridden={overridden} onPress={onToggle} />}
    </View>
  );
}

function IntField({ fieldKey, value, active, onChange }: {
  fieldKey: string; value: number | undefined; active: boolean;
  onChange: (key: string, val: number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const parsed = parseInt(draft, 10);
  const error = draft !== "" && !isNaN(parsed) ? getIntValidationError(fieldKey, parsed) : null;

  const handleChange = (text: string) => {
    setDraft(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && !getIntValidationError(fieldKey, num)) onChange(fieldKey, num);
  };

  const handleBlur = () => {
    if (draft === "" || isNaN(parseInt(draft, 10))) {
      const fallback = value ?? (DEFAULTS[fieldKey as keyof AssignmentConfig] as number);
      setDraft(String(fallback));
    }
  };

  return (
    <View>
      <TextInput
        style={[styles.intInput, !active && styles.intInputInactive, error && styles.intInputError]}
        keyboardType="numeric"
        value={draft}
        onChangeText={handleChange}
        onBlur={handleBlur}
        editable={active}
        placeholder={String(DEFAULTS[fieldKey as keyof AssignmentConfig])}
      />
      {error && <Text style={styles.validationError}>{error}</Text>}
    </View>
  );
}

function FieldInput({ fieldKey, value, active, setValue }: {
  fieldKey: string; value: any; active: boolean;
  setValue: (key: string, val: any) => void;
}) {
  if ((BOOL_FIELDS as readonly string[]).includes(fieldKey)) {
    return (
      <Switch value={value as boolean} onValueChange={(v) => setValue(fieldKey, v)}
        disabled={!active} trackColor={{ true: "#4F46E5", false: "#D1D5DB" }} />
    );
  }
  if ((ENUM_FIELDS as readonly string[]).includes(fieldKey) && ENUM_OPTIONS[fieldKey]) {
    return (
      <SegmentedControl options={ENUM_OPTIONS[fieldKey]} selected={value as string}
        onSelect={(v) => setValue(fieldKey, v)} disabled={!active} />
    );
  }
  if ((INT_FIELDS as readonly string[]).includes(fieldKey)) {
    return <IntField fieldKey={fieldKey} value={value as number} active={active} onChange={setValue} />;
  }
  return null;
}

function FieldCard({ fieldKey, active, mode, overridden, onToggle, displayValue, setValue }: {
  fieldKey: string; active: boolean; mode: "classroom" | "assignment";
  overridden: boolean; onToggle: () => void;
  displayValue: any; setValue: (key: string, val: any) => void;
}) {
  return (
    <View style={[styles.fieldCard, !active && styles.fieldCardInactive]}>
      <FieldHeader label={FIELD_LABELS[fieldKey]} active={active}
        mode={mode} overridden={overridden} onToggle={onToggle} />
      <FieldInput fieldKey={fieldKey} value={displayValue} active={active} setValue={setValue} />
    </View>
  );
}

export function ConfigEditor({ config, inheritedConfig, onChange, mode }: Props) {
  const resolved = { ...DEFAULTS, ...inheritedConfig };
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

  const setValue = (key: string, value: any) => onChange({ ...config, [key]: value });

  const getDisplayValue = (key: string) => {
    return isOverridden(key) ? config[key as keyof AssignmentConfig] : resolved[key as keyof AssignmentConfig];
  };

  return (
    <View style={styles.container}>
      {FIELD_ORDER.map((key) => (
        <FieldCard key={key} fieldKey={key} active={mode === "classroom" || isOverridden(key)}
          mode={mode} overridden={isOverridden(key)} onToggle={() => toggleOverride(key)}
          displayValue={getDisplayValue(key)} setValue={setValue} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  fieldCard: { backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12 },
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
  intInputError: { borderColor: "#EF4444" },
  validationError: { color: "#EF4444", fontSize: 11, marginTop: 4 },
});
