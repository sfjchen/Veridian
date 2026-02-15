import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Section } from './ui/Section';
import { palette } from '../constants/palette';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

export interface Problem {
  num: number;
  statement_tex: string;
}

interface DetectedProblemsPreviewProps {
  problems: Problem[];
  onReview: () => void;
  onPublish: () => void;
  isPublishing?: boolean;
}

/**
 * Preview of auto-detected problems before publishing assignment.
 * Offers options to review/edit or publish immediately.
 */
export function DetectedProblemsPreview({
  problems,
  onReview,
  onPublish,
  isPublishing = false,
}: DetectedProblemsPreviewProps) {
  return (
    <Card>
      <Section>
        <View style={styles.successBanner}>
          <Text style={styles.successText}>
            Successfully detected {problems.length} problem{problems.length !== 1 ? 's' : ''}!
          </Text>
        </View>

        <Text style={styles.title}>Detected Problems</Text>

        <Text style={styles.subtitle}>
          Review the problems below or publish the assignment immediately.
        </Text>

        <View style={styles.divider} />

        <ScrollView style={styles.problemsList}>
          {problems.map((problem) => (
            <View key={problem.num} style={styles.problemCard}>
              <Text style={styles.problemTitle}>
                Problem {problem.num}
              </Text>
              <Text style={styles.problemText}>
                {problem.statement_tex}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <View style={styles.actions}>
          <Button
            variant="outlined"
            onPress={onReview}
            disabled={isPublishing}
            style={styles.button}
          >
            Review & Edit
          </Button>
          <Button
            variant="contained"
            onPress={onPublish}
            disabled={isPublishing}
            style={styles.button}
          >
            {isPublishing ? 'Publishing...' : 'Publish to Students'}
          </Button>
        </View>
      </Section>
    </Card>
  );
}

const styles = StyleSheet.create({
  successBanner: {
    backgroundColor: palette.primaryMutedTint,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.body,
    color: palette.primary,
  },
  title: {
    ...typography.heading2,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.md,
  },
  problemsList: {
    maxHeight: 400,
  },
  problemCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
  },
  problemTitle: {
    ...typography.heading4,
    color: palette.text,
    marginBottom: spacing.xs,
  },
  problemText: {
    ...typography.small,
    fontFamily: 'monospace',
    color: palette.text,
    whiteSpace: 'pre-wrap',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
});
