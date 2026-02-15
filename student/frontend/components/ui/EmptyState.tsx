import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const MIN_TOUCH = 44;

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: { marginBottom: spacing.lg },
  title: {
    ...typography.h2,
    color: palette.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: { ...typography.button, color: palette.textOnPrimary },
});
