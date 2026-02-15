import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ScreenContainer, Section } from "../../components/ui";
import { ProblemEditor } from "../../components/ProblemEditor";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../lib/api";
import { alert } from "../../lib/alert";
import { Problem } from "../../types";

interface AssignmentData {
  id: string;
  title: string;
  problems: Problem[];
  prompt_latex?: string;
  published: boolean;
}

/**
 * Review screen for auto-detected problems before publishing assignment.
 *
 * Allows teachers to:
 * - Review detected problems
 * - Edit problems using ProblemEditor
 * - Publish to students
 * - Save as draft
 */
export function ReviewAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { assignmentId } = route.params;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    loadAssignment();
  }, [assignmentId]);

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const data = await api<AssignmentData>(`/assignments/${assignmentId}`);
      setAssignment(data);
      setProblems(data.problems || []);
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to load assignment");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!assignment) return;

    setSaving(true);
    try {
      await api(`/assignments/${assignmentId}`, {
        method: "PATCH",
        body: { problems },
      });
      showToast("Draft saved!");
      navigation.goBack();
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!assignment) return;

    setPublishing(true);
    try {
      // First update problems if edited
      if (JSON.stringify(problems) !== JSON.stringify(assignment.problems)) {
        await api(`/assignments/${assignmentId}`, {
          method: "PATCH",
          body: { problems },
        });
      }

      // Then publish
      await api(`/assignments/${assignmentId}/publish`, {
        method: "POST",
      });

      showToast("Assignment published!");
      navigation.goBack();
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to publish assignment");
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !assignment) {
    return (
      <ScreenContainer maxWidth="form">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading assignment...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth="form">
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Review Assignment</Text>

        <Section title="Assignment Details">
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Title:</Text>
            <Text style={styles.detailValue}>{assignment.title}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              assignment.published ? styles.statusPublished : styles.statusDraft
            ]}>
              <Text style={[
                styles.statusText,
                assignment.published ? styles.statusPublishedText : styles.statusDraftText
              ]}>
                {assignment.published ? "Published" : "Draft"}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Problems:</Text>
            <Text style={styles.detailValue}>{problems.length}</Text>
          </View>
        </Section>

        <Section title="Edit Problems">
          <Text style={styles.hint}>
            Review and edit the auto-detected problems below. Use LaTeX for math notation.
          </Text>
          <ProblemEditor problems={problems} onChange={setProblems} />
        </Section>

        <View style={styles.actions}>
          <Button
            variant="outlined"
            onPress={handleSaveDraft}
            loading={saving}
            disabled={saving || publishing}
            style={styles.button}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            onPress={handlePublish}
            loading={publishing}
            disabled={saving || publishing}
            style={styles.button}
          >
            {assignment.published ? "Update & Republish" : "Publish to Students"}
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.bodyBold,
    color: palette.textPrimary,
    width: 100,
  },
  detailValue: {
    ...typography.body,
    color: palette.textSecondary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  statusPublished: {
    backgroundColor: palette.primaryMutedTint,
  },
  statusDraft: {
    backgroundColor: palette.backgroundSecondary,
  },
  statusText: {
    ...typography.caption,
  },
  statusPublishedText: {
    color: palette.primary,
  },
  statusDraftText: {
    color: palette.textMuted,
  },
  hint: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  button: {
    flex: 1,
  },
});
