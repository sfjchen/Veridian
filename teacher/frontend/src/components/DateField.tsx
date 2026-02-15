import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { palette, radius } from "../constants/palette";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDate(str: string): Date {
  const d = new Date(str + "T12:00:00Z");
  return isNaN(d.getTime()) ? new Date() : d;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(str: string): string {
  if (!str.trim()) return "";
  const d = new Date(str + "T12:00:00Z");
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
};

let DateTimePicker: React.ComponentType<any> | null = null;
try {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    // Optional native-only dep; require() used to avoid loading on web
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  }
} catch {
  DateTimePicker = null;
}

export function DateField({ value, onChange, placeholder = "Due date (optional)", accessibilityLabel }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const displayValue = value.trim() ? formatDisplay(value) : "";

  if (Platform.OS === "web" || !DateTimePicker) {
    return (
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD (optional)"
        value={value}
        onChangeText={onChange}
        accessibilityLabel={accessibilityLabel ?? placeholder}
      />
    );
  }

  const handleChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event?.type === "dismissed") return;
    }
    if (selected) onChange(toYYYYMMDD(selected));
    if (Platform.OS === "ios") setShowPicker(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (displayValue || placeholder)}
      >
        <Text style={displayValue ? styles.inputText : styles.inputPlaceholder}>
          {displayValue || placeholder}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value.trim() && DATE_PATTERN.test(value.trim()) ? toDate(value) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: radius.input,
    padding: 14,
    marginBottom: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  inputText: { fontSize: 16, color: palette.textPrimary },
  inputPlaceholder: { fontSize: 16, color: palette.textMuted },
});
