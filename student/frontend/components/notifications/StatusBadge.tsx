import { StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/constants/palette';
import { typography } from '@/constants/typography';

export type StatusTone = 'info' | 'success' | 'error';

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

function colorsForTone(tone: StatusTone): { bg: string; border: string; text: string } {
  if (tone === "success") {
    return { bg: palette.successBg, border: palette.success, text: palette.success };
  }
  if (tone === "error") {
    return { bg: palette.errorBg, border: palette.error, text: palette.error };
  }
  return { bg: palette.card, border: palette.borderStrong, text: palette.textSecondary };
}

export function StatusBadge({ label, tone = 'info' }: StatusBadgeProps) {
  const colors = colorsForTone(tone);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.chip,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "center",
    maxWidth: "90%",
  },
  label: {
    ...typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },
});
