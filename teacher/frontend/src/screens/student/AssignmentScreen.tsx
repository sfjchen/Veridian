import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { AssignmentDetail, Submission } from "../../types";
import { alert } from "../../lib/alert";

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
  const [loadError, setLoadError] = useState<string | null>(null);
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
        setLoadError(e instanceof Error ? e.message : "Failed to load assignment");
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
    return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  }
  if (loadError && !assignment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.error}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchAssignment()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!assignment) return <Text style={styles.error}>Assignment not found</Text>;
  const hasCompletedSubmission = submissions.some((submission) => Boolean(submission.download_url));
  const hasIncompleteSubmission = submissions.some((submission) => !submission.download_url);

  return (
    <ScrollView style={styles.container}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold" },
  due: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  assignmentContainer: { flex: 1, marginBottom: 16 },
  assignmentImage: {
    width: "100%",
    minHeight: 220,
    height: 320,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  submitButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 16,
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  errorContainer: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  error: { textAlign: "center", color: "#EF4444", marginTop: 40 },
  retryButton: {
    marginTop: 16, backgroundColor: "#4F46E5", borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  retryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#EF4444", marginTop: 8 },
  pdfNotice: {
    backgroundColor: "#FEF3C7", borderRadius: 8, padding: 16, marginBottom: 16,
  },
  pdfNoticeText: { fontSize: 14, color: "#92400E", marginBottom: 8 },
  pdfPreview: {
    width: "100%",
    minHeight: 220,
    height: 300,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  binaryNotice: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  binaryNoticeText: { fontSize: 14, color: "#1E3A8A", marginBottom: 8 },
  downloadLink: {
    backgroundColor: "#4F46E5", borderRadius: 6, paddingVertical: 10,
    paddingHorizontal: 16, alignSelf: "flex-start",
  },
  downloadLinkText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  alreadySubmitted: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
  },
  alreadySubmittedText: { color: "#065F46", fontSize: 14, fontWeight: "500" },
  historySection: { marginTop: 24, marginBottom: 32 },
  emptyText: { color: "#9CA3AF", marginTop: 8 },
  submissionCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  submissionMeta: { flex: 1 },
  submissionDate: { fontSize: 14, color: "#374151" },
  historyDownloadButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  historyDownloadText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  unavailableText: { fontSize: 13, color: "#9CA3AF", marginLeft: 12 },
});
