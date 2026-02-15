import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/constants/theme';

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
  const { radius, spacing, typography, semantic } = useAppTheme();
  return (
    <View style={[styles.container, { paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }]}>
      {icon ? <View style={{ marginBottom: spacing.lg }}>{icon}</View> : null}
      <Text style={{ ...typography.h2, color: semantic.text.primary, textAlign: 'center', marginBottom: spacing.sm }}>
        {title}
      </Text>
      {description ? (
        <Text style={{ ...typography.bodySmall, color: semantic.text.muted, textAlign: 'center', marginBottom: spacing.lg }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [
            {
              minHeight: MIN_TOUCH,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.button,
              backgroundColor: semantic.action.primary,
              justifyContent: 'center',
              marginTop: spacing.md,
            },
            pressed && styles.buttonPressed,
          ]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={{ ...typography.button, color: semantic.text.onPrimary }}>{actionLabel}</Text>
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
  },
  buttonPressed: { opacity: 0.9 },
});
