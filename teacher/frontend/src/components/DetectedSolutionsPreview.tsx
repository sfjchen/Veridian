import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Section } from './ui/Section';
import { palette } from '../constants/palette';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

export interface Solution {
  num: number;
  solution_tex: string;
}

interface DetectedSolutionsPreviewProps {
  solutions: Solution[];
  onReview: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

/**
 * Preview of auto-detected solutions from answer key.
 * Offers options to review/edit or save immediately.
 */
export function DetectedSolutionsPreview({
  solutions,
  onReview,
  onSave,
  isSaving = false,
}: DetectedSolutionsPreviewProps) {
  return (
    <Card>
      <Section>
        <View style={styles.successBanner}>
          <Text style={styles.successText}>
            Successfully detected {solutions.length} solution{solutions.length !== 1 ? 's' : ''}!
          </Text>
        </View>

        <Text style={styles.title}>Detected Solutions</Text>

        <Text style={styles.subtitle}>
          Review the solutions below or save them to the assignment immediately.
        </Text>

        <View style={styles.divider} />

        <ScrollView style={styles.solutionsList}>
          {solutions.map((solution) => (
            <View key={solution.num} style={styles.solutionCard}>
              <Text style={styles.solutionTitle}>
                Solution {solution.num}
              </Text>
              <Text style={styles.solutionText}>
                {solution.solution_tex}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <View style={styles.actions}>
          <Button
            variant="outlined"
            onPress={onReview}
            disabled={isSaving}
            style={styles.button}
          >
            Review & Edit
          </Button>
          <Button
            variant="contained"
            onPress={onSave}
            disabled={isSaving}
            style={styles.button}
          >
            {isSaving ? 'Saving...' : 'Save Solutions'}
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
  solutionsList: {
    maxHeight: 400,
  },
  solutionCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
  },
  solutionTitle: {
    ...typography.heading4,
    color: palette.text,
    marginBottom: spacing.xs,
  },
  solutionText: {
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
