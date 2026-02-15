import { StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/constants/palette';
import { typography } from '@/constants/typography';

export type ToastTone = 'success' | 'error' | 'info';

type ToastProps = {
  message: string;
  tone?: ToastTone;
};

function backgroundForTone(tone: ToastTone): string {
  if (tone === "success") return palette.success;
  if (tone === "error") return palette.error;
  return palette.textPrimary;
}

export function Toast({ message, tone = 'info' }: ToastProps) {
  return (
    <View style={[styles.toast, { backgroundColor: backgroundForTone(tone) }]}>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    minWidth: 180,
    maxWidth: 320,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    color: palette.textOnPrimary,
    ...typography.caption,
    fontWeight: "600",
  },
});
