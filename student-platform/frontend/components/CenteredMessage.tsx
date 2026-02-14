import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type CenteredMessageProps = {
  message?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  style?: ViewStyle;
};

export function CenteredMessage({ message, subtitle, action, style }: CenteredMessageProps) {
  return (
    <View style={[styles.centered, style]}>
      {message != null ? <View style={styles.block}>{message}</View> : null}
      {subtitle != null ? <View style={styles.block}>{subtitle}</View> : null}
      {action != null ? <View style={styles.actionBlock}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  block: {
    alignItems: 'center',
  },
  actionBlock: {
    marginTop: 16,
  },
});
