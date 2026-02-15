import { StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/constants/palette';

export type StatusTone = 'info' | 'success' | 'error';

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

function colorsForTone(tone: StatusTone): { bg: string; border: string; text: string } {
  if (tone === 'success') {
    return { bg: '#dcfce7', border: '#16a34a', text: '#166534' };
  }
  if (tone === 'error') {
    return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
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
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
