import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/constants/theme';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const MIN_TOUCH = 44;

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { radius, spacing, typography, semantic } = useAppTheme();
  return (
    <View style={[styles.container, { padding: spacing.lg }]}>
      <Text style={{ ...typography.body, color: semantic.state.error, textAlign: 'center', marginBottom: spacing.sm }}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [
            {
              minHeight: MIN_TOUCH,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.button,
              backgroundColor: semantic.action.primary,
              justifyContent: 'center',
              marginTop: spacing.xs,
            },
            pressed && styles.buttonPressed,
          ]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={{ ...typography.buttonSmall, color: semantic.text.onPrimary }}>Retry</Text>
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
