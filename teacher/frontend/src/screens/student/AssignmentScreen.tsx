import React, { useState, useEffect, useRef } from "react";
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
import { palette, radius, typography } from "../../constants/palette";
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
  const {
    submissions,
    loading: submissionsLoading,
    error: submissionsError,
    refresh: refreshSubmissions,
  } = useSubmissions(assignmentId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
        if (cancelled) return;
        setAssignment(data);
        setAssignmentContent(null);
        setIsPdf(false);
        setPdfPreviewUri(null);
        setImagePreviewUrl(null);
        setBinaryDownloadUrl(null);
        if (data.assignment_file_download_url) {
          const resp = await fetch(data.assignment_file_download_url);
          if (!resp.ok) throw new Error(`Failed to fetch assignment file: ${resp.status}`);
          const blob = await resp.blob();
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (cancelled) return;

          const contentType = resp.headers.get("content-type") ?? "";
          if (looksLikePdf(contentType, bytes)) {
            if (!cancelled) setIsPdf(true);
            try {
              const previewUri = await createPdfPreviewDataUri(blob);
              if (!cancelled) setPdfPreviewUri(previewUri);
            } catch (previewError) {
              console.error("Failed to generate PDF preview image:", previewError);
              if (!cancelled) setPdfPreviewUri(null);
            }
          } else if (looksLikeImage(contentType, bytes)) {
            if (!cancelled) {
              setImagePreviewUrl(data.assignment_file_download_url ?? null);
              setIsPdf(false);
            }
          } else if (looksLikeText(contentType, bytes)) {
            const text = await blob.text();
            if (cancelled) return;
            setAssignmentContent(sanitizeLatexContent(text));
          } else {
            if (!cancelled) setBinaryDownloadUrl(data.assignment_file_download_url ?? null);
          }
        }
      } catch (e: any) {
        if (!cancelled) alert("Error", e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId]);

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

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  if (!assignment) return <Text style={styles.error}>Assignment not found</Text>;
  const hasCompletedSubmission = submissions.some((submission) => Boolean(submission.download_url));
  const hasIncompleteSubmission = submissions.some((submission) => !submission.download_url);

  return (
    <ScreenContainer>
      <ScrollView style={styles.scrollContent}>
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
  scrollContent: { flex: 1 },
  title: { ...typography.h1, color: palette.textPrimary },
  due: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xxs, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: spacing.xs, color: palette.textPrimary },
  assignmentContainer: { flex: 1, marginBottom: spacing.md },
  assignmentImage: {
    width: "100%",
    minHeight: 220,
    height: 320,
    borderRadius: radius.button,
    backgroundColor: palette.surface,
  },
  submitButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  error: { textAlign: "center", color: palette.error, marginTop: spacing.xxl },
  errorText: { color: palette.error, marginTop: spacing.xs },
  pdfNotice: {
    backgroundColor: palette.warningBg,
    borderRadius: radius.button,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pdfNoticeText: { fontSize: 14, color: "#92400E", marginBottom: spacing.xs },
  pdfPreview: {
    width: "100%",
    minHeight: 220,
    height: 300,
    borderRadius: radius.button,
    backgroundColor: palette.surface,
    marginBottom: spacing.xs,
  },
  binaryNotice: {
    backgroundColor: "#EFF6FF",
    borderRadius: radius.button,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  binaryNoticeText: { fontSize: 14, color: "#1E3A8A", marginBottom: 8 },
  downloadLink: {
    backgroundColor: palette.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  downloadLinkText: { color: palette.white, fontSize: 14, fontWeight: "600" },
  alreadySubmitted: {
    backgroundColor: palette.successBg,
    borderRadius: radius.button,
    padding: 14,
    marginTop: spacing.md,
  },
  alreadySubmittedText: { color: "#065F46", fontSize: 14, fontWeight: "500" },
  historySection: { marginTop: spacing.lg, marginBottom: spacing.xl },
  emptyText: { color: palette.textDisabled, marginTop: spacing.xs },
  submissionCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.button,
    padding: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  submissionMeta: { flex: 1 },
  submissionDate: { fontSize: 14, color: palette.textSecondary },
  historyDownloadButton: {
    backgroundColor: palette.primary,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  historyDownloadText: { color: palette.white, fontSize: 13, fontWeight: "600" },
  unavailableText: { fontSize: 13, color: palette.textDisabled, marginLeft: spacing.sm },
});
