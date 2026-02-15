import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { API_URL, API_URL_MISSING } from "../lib/apiBaseUrl";
import { palette } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

export function ApiUrlHint(): React.ReactNode {
  const [serverUnreachable, setServerUnreachable] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (API_URL_MISSING || process.env.NODE_ENV === "production") return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API_URL}/health`, { signal: ac.signal })
        .then((r) => { if (!r.ok) setServerUnreachable(true); })
        .catch(() => setServerUnreachable(true));
    }, 500);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, []);

  const onDismiss = useCallback(() => setDismissed(true), []);

  if (dismissed) return null;
  if (API_URL_MISSING) {
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>
          Set EXPO_PUBLIC_API_URL in .env and restart Expo.
        </Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (serverUnreachable) {
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>
          Cannot reach server. Start the teacher backend.
        </Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.warningBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border ?? "#e5e7eb",
  },
  text: {
    flex: 1,
    ...typography.bodySmall,
    color: palette.textPrimary,
  },
  dismiss: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  dismissText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: palette.primary,
  },
});
