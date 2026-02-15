import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Toast, type ToastTone } from './Toast';

export type ToastNotice = {
  id: string;
  message: string;
  tone?: ToastTone;
};

type ToastHostProps = {
  toast: ToastNotice | null;
  onHide: () => void;
  durationMs?: number;
};

export function ToastHost({ toast, onHide, durationMs = 2500 }: ToastHostProps) {
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(onHide, durationMs);
    return () => clearTimeout(timeout);
  }, [toast, onHide, durationMs]);

  if (!toast) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <Toast message={toast.message} tone={toast.tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 120,
  },
});
