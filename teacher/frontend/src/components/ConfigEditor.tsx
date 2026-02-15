import React, { useState } from "react";
import { View, Text, Switch, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { AssignmentConfig } from "../types";
import { palette, radius, elevation } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

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
    { value: "auto_page_change", label: "Auto (page)" },
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

const FIELD_GROUPS: { title: string; subtitle: string; fields: readonly string[] }[] = [
  {
    title: "Guidance and Hints",
    subtitle: "How much help the garden gives when students are stuck.",
    fields: ["chat_enabled", "hint_level", "student_mistake_visibility"],
  },
  {
    title: "Analysis Engine",
    subtitle: "When the system inspects work and how quickly it responds.",
    fields: ["analysis_trigger", "analysis_debounce_seconds", "check_button_visible"],
  },
  {
    title: "Dot and Alert Signals",
    subtitle: "Visual density and severity thresholds for mistake highlights.",
    fields: ["dot_threshold", "max_dots_shown", "notification_style"],
  },
];

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
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  segmentActive: { backgroundColor: palette.primary, ...elevation.shadowSm },
  segmentText: { ...typography.caption, fontWeight: "600", color: palette.textSecondary },
  segmentTextActive: { color: palette.textOnPrimary },
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
        disabled={!active} trackColor={{ true: palette.primary, false: palette.borderStrong }} />
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
      {FIELD_GROUPS.map((group) => (
        <View key={group.title} style={styles.groupCard}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
          <View style={styles.groupFields}>
            {group.fields.map((key) => (
              <FieldCard
                key={key}
                fieldKey={key}
                active={mode === "classroom" || isOverridden(key)}
                mode={mode}
                overridden={isOverridden(key)}
                onToggle={() => toggleOverride(key)}
                displayValue={getDisplayValue(key)}
                setValue={setValue}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  groupCard: {
    backgroundColor: palette.forestMist,
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  groupTitle: {
    ...typography.body,
    color: palette.forestCanopy,
    fontWeight: "700",
  },
  groupSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  groupFields: {
    gap: spacing.sm,
  },
  fieldCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    ...elevation.shadowSm,
  },
  fieldCardInactive: { opacity: 0.6 },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  fieldLabel: { ...typography.body, fontWeight: "700", color: palette.textSecondary },
  fieldLabelInactive: { color: palette.textDisabled },
  overrideChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    backgroundColor: palette.tabInactive,
  },
  overrideChipActive: { backgroundColor: palette.primary },
  overrideText: { ...typography.caption, fontWeight: "600", color: palette.textMuted },
  overrideTextActive: { color: palette.textOnPrimary },
  intInput: {
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: palette.textPrimary,
    backgroundColor: palette.surfaceElevated,
  },
  intInputInactive: { backgroundColor: palette.surface, color: palette.textDisabled },
  intInputError: { borderColor: palette.error },
  validationError: { ...typography.caption, color: palette.error, marginTop: spacing.xs },
});
