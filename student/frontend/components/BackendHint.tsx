import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BACKEND_URL, BACKEND_URL_MISSING } from "@/lib/backendBaseUrl";
import { palette } from "@/constants/palette";

export function BackendHint(): React.ReactNode {
  const [serverUnreachable, setServerUnreachable] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (BACKEND_URL_MISSING || process.env.NODE_ENV === "production") return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetch(`${BACKEND_URL}/health`, { signal: ac.signal })
        .then((r) => {
          if (!r.ok) setServerUnreachable(true);
        })
        .catch(() => setServerUnreachable(true));
    }, 500);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, []);

  const onDismiss = useCallback(() => setDismissed(true), []);

  if (dismissed) return null;
  if (BACKEND_URL_MISSING) {
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>
          Set EXPO_PUBLIC_BACKEND_URL in .env and restart Expo.
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
          Cannot reach backend. Start the student backend.
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
    backgroundColor: "#fef3c7",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: palette.textPrimary,
  },
  dismiss: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.primary,
  },
});
