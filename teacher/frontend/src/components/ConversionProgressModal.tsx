import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Card } from "./ui/Card";
import { palette } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

interface ConversionProgressModalProps {
  visible: boolean;
  fileName?: string;
  stage?: string;
  progress?: number;
  message?: string;
  currentPage?: number;
  totalPages?: number;
  connected?: boolean;
}

function clampProgress(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export function ConversionProgressModal({
  visible,
  fileName,
  stage = "Converting file...",
  progress = 0,
  message,
  currentPage,
  totalPages,
  connected = false,
}: ConversionProgressModalProps) {
  const normalized = clampProgress(progress);
  const widthPercent = `${normalized}%` as `${number}%`;
  const pageText =
    currentPage !== undefined && totalPages !== undefined
      ? `Chunk ${currentPage} of ${totalPages}`
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          {normalized >= 100 ? null : (
            <ActivityIndicator
              size="large"
              color={palette.primary}
              style={styles.spinner}
            />
          )}

          <Text style={styles.title}>{stage}</Text>

          {fileName ? <Text style={styles.fileName}>{fileName}</Text> : null}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: widthPercent }]} />
          </View>
          <Text style={styles.progressLabel}>{normalized}%</Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}
          {pageText ? <Text style={styles.page}>{pageText}</Text> : null}

          <Text style={styles.connectionState}>
            {connected ? "Live progress connected" : "Connecting to live progress..."}
          </Text>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    minWidth: 320,
    maxWidth: 520,
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.xs,
  },
  spinner: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: palette.textPrimary,
    textAlign: "center",
  },
  fileName: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: "center",
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.border,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.primary,
  },
  progressLabel: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  message: {
    ...typography.bodySmall,
    color: palette.textPrimary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  page: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  connectionState: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.sm,
  },
});
