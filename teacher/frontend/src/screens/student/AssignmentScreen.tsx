import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import * as Linking from "expo-linking";
import { api } from "../../lib/api";
import { createPdfPreviewDataUri, looksLikeImage, looksLikePdf, looksLikeText } from "../../lib/pdfPreview";
import { useSubmissions } from "../../hooks/useSubmissions";
import { LatexRenderer } from "../../components/LatexRenderer";
import { FileUploader } from "../../components/FileUploader";
import { ScreenContainer } from "../../components/ui";
import { AssignmentDetail, Submission } from "../../types";
import { alert } from "../../lib/alert";
import { palette, radius } from "../../constants/palette";
import { typography } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

const MAX_ASSIGNMENT_FILE_LENGTH = 100_000;

function sanitizeLatexContent(raw: string): string {
  if (raw.length > MAX_ASSIGNMENT_FILE_LENGTH) {
    throw new Error("Assignment file too large");
  }
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<iframe[\s\S]*?\/>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?\/>/gi, "");
}

export function AssignmentScreen({ route }: { route: any }) {
  const { assignmentId } = route.params;
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentContent, setAssignmentContent] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pdfPreviewUri, setPdfPreviewUri] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [binaryDownloadUrl, setBinaryDownloadUrl] = useState<string | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    submissions,
    loading: submissionsLoading,
    error: submissionsError,
    refresh: refreshSubmissions,
  } = useSubmissions(assignmentId);

  const mountedRef = useRef(true);

  const fetchAssignment = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
      if (!mountedRef.current) return;
      setAssignment(data);
      setAssignmentContent(null);
      setIsPdf(false);
      setPdfPreviewUri(null);
      setImagePreviewUrl(null);
      setBinaryDownloadUrl(null);
      if (data.prompt_latex) {
        setAssignmentContent(sanitizeLatexContent(data.prompt_latex));
      } else if (data.assignment_file_download_url) {
        try {
          const resp = await fetch(data.assignment_file_download_url);
          if (resp.ok) {
            const blob = await resp.blob();
            const bytes = new Uint8Array(await blob.arrayBuffer());
            if (!mountedRef.current) return;

            const contentType = resp.headers.get("content-type") ?? "";
            if (looksLikePdf(contentType, bytes)) {
              if (mountedRef.current) setIsPdf(true);
              try {
                const previewUri = await createPdfPreviewDataUri(blob);
                if (mountedRef.current) setPdfPreviewUri(previewUri);
              } catch {
                if (mountedRef.current) setPdfPreviewUri(null);
              }
            } else if (looksLikeImage(contentType, bytes)) {
              if (mountedRef.current) {
                setImagePreviewUrl(data.assignment_file_download_url ?? null);
                setIsPdf(false);
              }
            } else if (looksLikeText(contentType, bytes)) {
              const text = await blob.text();
              if (!mountedRef.current) return;
              setAssignmentContent(sanitizeLatexContent(text));
            } else {
              if (mountedRef.current) setBinaryDownloadUrl(data.assignment_file_download_url ?? null);
            }
          }
        } catch {
          console.warn("Could not load assignment file");
        }
      }
    } catch (e: any) {
      if (mountedRef.current) {
        alert("Error", (e as Error).message);
        setLoadError((e as Error).message ?? "Failed to load");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await api<{ upload_url: string }>(`/assignments/${assignmentId}/submissions`, {
        method: "POST",
      });
      setSubmissionUrl(result.upload_url);
    } catch (e: any) {
      alert("Error", e.message);
      if (e instanceof Error && e.message.includes("already exists")) {
        refreshSubmissions();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !assignment) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <ActivityIndicator size="large" style={styles.loader} color={palette.primary} />
      </ScreenContainer>
    );
  }
  if (loadError && !assignment) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchAssignment()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }
  if (!assignment) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <Text style={styles.error}>Assignment not found</Text>
      </ScreenContainer>
    );
  }
  const hasCompletedSubmission = submissions.some((submission) => Boolean(submission.download_url));
  const hasIncompleteSubmission = submissions.some((submission) => !submission.download_url);

  return (
    <ScreenContainer maxWidth="dashboard">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{assignment.title}</Text>
      {assignment.due_date && (
        <Text style={styles.due}>
          Due: {new Date(assignment.due_date).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
          })}
        </Text>
      )}
      {assignmentContent ? (
        <View style={styles.assignmentContainer}>
          <Text style={styles.sectionTitle}>Problem</Text>
          <LatexRenderer latex={assignmentContent} />
        </View>
      ) : imagePreviewUrl ? (
        <View style={styles.assignmentContainer}>
          <Text style={styles.sectionTitle}>Problem</Text>
          <Image source={{ uri: imagePreviewUrl }} style={styles.assignmentImage} resizeMode="contain" />
        </View>
      ) : isPdf ? (
        <View style={styles.pdfNotice}>
          <Text style={styles.pdfNoticeText}>
            This assignment is a PDF. Your teacher will convert it for in-app viewing soon.
          </Text>
          {pdfPreviewUri && (
            <Image source={{ uri: pdfPreviewUri }} style={styles.pdfPreview} resizeMode="contain" />
          )}
          {assignment.assignment_file_download_url && (
            <TouchableOpacity
              style={styles.downloadLink}
              onPress={() => Linking.openURL(assignment.assignment_file_download_url!)}
            >
              <Text style={styles.downloadLinkText}>Download PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : binaryDownloadUrl ? (
        <View style={styles.binaryNotice}>
          <Text style={styles.binaryNoticeText}>
            This file type cannot be previewed in-app.
          </Text>
          <TouchableOpacity style={styles.downloadLink} onPress={() => Linking.openURL(binaryDownloadUrl)}>
            <Text style={styles.downloadLinkText}>Download File</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!submissionUrl ? (
        hasCompletedSubmission ? (
          <View style={styles.alreadySubmitted}>
            <Text style={styles.alreadySubmittedText}>Submission received for this assignment.</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitButtonText}>
              {submitting
                ? "Submitting..."
                : hasIncompleteSubmission
                  ? "Resume Submission Upload"
                  : "Submit Solution"}
            </Text>
          </TouchableOpacity>
        )
      ) : (
        <FileUploader
          uploadUrl={submissionUrl}
          label="Upload Solution"
          onUploadComplete={() => {
            setSubmissionUrl(null);
            refreshSubmissions();
            alert("Success", "Solution submitted!");
          }}
        />
      )}

      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Submission History</Text>
        {submissionsLoading ? (
          <ActivityIndicator />
        ) : submissionsError ? (
          <Text style={styles.errorText}>{submissionsError}</Text>
        ) : submissions.length === 0 ? (
          <Text style={styles.emptyText}>No submissions yet</Text>
        ) : (
          submissions.map((submission: Submission) => (
            <View key={submission.id} style={styles.submissionCard}>
              <View style={styles.submissionMeta}>
                <Text style={styles.submissionDate}>
                  {new Date(submission.submitted_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                </Text>
              </View>
              {submission.download_url ? (
                <TouchableOpacity
                  style={styles.historyDownloadButton}
                  onPress={() => Linking.openURL(submission.download_url!)}
                >
                  <Text style={styles.historyDownloadText}>Open</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.unavailableText}>Unavailable</Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  title: { ...typography.h1 },
  due: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xxs, marginBottom: spacing.md },
  sectionTitle: { ...typography.body, fontWeight: "600" as const, marginBottom: spacing.xs },
  assignmentContainer: { flex: 1, marginBottom: spacing.md },
  assignmentImage: {
    width: "100%",
    minHeight: 220,
    height: 320,
    borderRadius: radius.input,
    backgroundColor: palette.surface,
  },
  submitButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    padding: spacing.md,
    alignItems: "center" as const,
    marginTop: spacing.md,
  },
  submitButtonText: { ...typography.button, color: palette.white },
  errorContainer: { flex: 1, padding: spacing.lg, alignItems: "center" as const, justifyContent: "center" as const },
  error: { ...typography.body, textAlign: "center" as const, color: palette.error, marginTop: spacing.xxl },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryButtonText: { ...typography.button, color: palette.white },
  errorText: { ...typography.bodySmall, color: palette.error, marginTop: spacing.xs },
  pdfNotice: {
    backgroundColor: palette.warningBg,
    borderRadius: radius.input,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pdfNoticeText: { ...typography.bodySmall, color: palette.warning, marginBottom: spacing.xs },
  pdfPreview: {
    width: "100%",
    minHeight: 220,
    height: 300,
    borderRadius: radius.input,
    backgroundColor: palette.surface,
    marginBottom: spacing.xs,
  },
  binaryNotice: {
    backgroundColor: palette.primaryMutedTint,
    borderRadius: radius.input,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  binaryNoticeText: { ...typography.bodySmall, color: palette.textSecondary, marginBottom: spacing.xs },
  downloadLink: {
    backgroundColor: palette.primary,
    borderRadius: radius.input,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start" as const,
  },
  downloadLinkText: { ...typography.bodySmall, color: palette.white, fontWeight: "600" as const },
  alreadySubmitted: {
    backgroundColor: palette.successBg,
    borderRadius: radius.input,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  alreadySubmittedText: { ...typography.bodySmall, color: palette.success, fontWeight: "500" as const },
  historySection: { marginTop: spacing.lg, marginBottom: spacing.xl },
  emptyText: { ...typography.bodySmall, color: palette.textDisabled, marginTop: spacing.xs },
  submissionCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.input,
    padding: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  submissionMeta: { flex: 1 },
  submissionDate: { ...typography.bodySmall, color: palette.textSecondary },
  historyDownloadButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.input,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  historyDownloadText: { ...typography.bodySmall, color: palette.white, fontWeight: "600" as const },
  unavailableText: { ...typography.bodySmall, color: palette.textDisabled, marginLeft: spacing.sm },
});
