import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const MIN_TOUCH = 44;

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.buttonText}>Retry</Text>
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
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
    color: palette.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  button: {
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: { ...typography.buttonSmall, color: palette.textOnPrimary },
});
