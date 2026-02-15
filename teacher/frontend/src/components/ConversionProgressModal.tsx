import React from 'react';
import {
  Modal,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Card } from './ui/Card';
import { palette } from '../constants/palette';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

interface ConversionProgressModalProps {
  visible: boolean;
  fileName?: string;
  stage?: string;
}

/**
 * Modal displaying PDF/TEX conversion progress.
 *
 * For initial implementation, shows simple loading spinner.
 * TODO: Add WebSocket integration for real-time progress (task #5).
 */
export function ConversionProgressModal({
  visible,
  fileName,
  stage = 'Converting file...',
}: ConversionProgressModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <ActivityIndicator
            size="large"
            color={palette.primary}
            style={styles.spinner}
          />

          <Text style={styles.title}>{stage}</Text>

          {fileName && (
            <Text style={styles.fileName}>{fileName}</Text>
          )}

          <Text style={styles.note}>
            This may take a minute for large documents...
          </Text>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    minWidth: 320,
    maxWidth: 500,
    alignItems: 'center',
    padding: spacing.xl,
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading3,
    color: palette.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  fileName: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  note: {
    ...typography.small,
    color: palette.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
