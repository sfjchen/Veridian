import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { API_URL } from "../../lib/apiBaseUrl";
import { createPdfPreviewDataUri, looksLikeImage, looksLikePdf, looksLikeText } from "../../lib/pdfPreview";
import { useSubmissions } from "../../hooks/useSubmissions";
import { LatexRenderer } from "../../components/LatexRenderer";
import { FileUploader } from "../../components/FileUploader";
import { DateField } from "../../components/DateField";
import { palette, radius, typography } from "../../constants/palette";
import { AssignmentDetail, Submission } from "../../types";
import { alert } from "../../lib/alert";

const MAX_CONTENT_LENGTH = 100_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function sanitizeContent(raw: string): string {
  if (raw.length > MAX_CONTENT_LENGTH) throw new Error("File too large to preview");
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?\/>/gi, "");
}

type ViewMode = "teacher" | "student";

export function TeacherAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { assignmentId } = route.params;
  const mountedRef = useRef(true);
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentContent, setAssignmentContent] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pdfPreviewUri, setPdfPreviewUri] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [binaryDownloadUrl, setBinaryDownloadUrl] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("teacher");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [reuploadUrls, setReuploadUrls] = useState<{
    assignment_file_upload_url?: string;
    answer_key_upload_url?: string;
  } | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const {
    submissions,
    loading: submissionsLoading,
    error: submissionsError,
    refresh: refreshSubmissions,
  } = useSubmissions(assignmentId);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAssignment(), refreshSubmissions()]);
    if (mountedRef.current) setRefreshing(false);
  }, [fetchAssignment, refreshSubmissions]);

  const fetchAssignment = useCallback(async () => {
    try {
      const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
      if (!mountedRef.current) return;
      setAssignment(data);
      setEditTitle(data.title);
      setEditDueDate(data.due_date ? data.due_date.split("T")[0] : "");
      setAssignmentContent(null);
      setIsPdf(false);
      setPdfPreviewUri(null);
      setImagePreviewUrl(null);
      setBinaryDownloadUrl(null);

      if (data.assignment_file_download_url) {
        const resp = await fetch(data.assignment_file_download_url);
        if (!mountedRef.current) return;
        if (resp.ok) {
          const blob = await resp.blob();
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (!mountedRef.current) return;

          const contentType = resp.headers.get("content-type") ?? "";
          if (looksLikePdf(contentType, bytes)) {
            setIsPdf(true);
            setAssignmentContent(null);
            try {
              const previewUri = await createPdfPreviewDataUri(blob);
              if (mountedRef.current) setPdfPreviewUri(previewUri);
            } catch (previewError) {
              console.error("Failed to generate PDF preview image:", previewError);
              if (mountedRef.current) setPdfPreviewUri(null);
            }
          } else if (looksLikeImage(contentType, bytes)) {
            setIsPdf(false);
            setImagePreviewUrl(data.assignment_file_download_url ?? null);
          } else if (looksLikeText(contentType, bytes)) {
            const text = await blob.text();
            if (!mountedRef.current) return;
            setIsPdf(false);
            setAssignmentContent(sanitizeContent(text));
          } else {
            setIsPdf(false);
            setBinaryDownloadUrl(data.assignment_file_download_url ?? null);
          }
        }
      }
    } catch (e: any) {
      if (mountedRef.current) alert("Error", e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [assignmentId]);

  const handleConvertPdf = async () => {
    if (!assignment?.assignment_file_download_url) return;
    setConverting(true);
    try {
      const pdfResp = await fetch(assignment.assignment_file_download_url);
      if (!pdfResp.ok) throw new Error("Failed to download PDF");
      const blob = await pdfResp.blob();

      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", blob as any, "assignment.pdf");

      const convertResp = await fetch(`${API_URL}/convert/pdf-to-latex`, {
        method: "POST",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
        body: formData,
      });

      if (!convertResp.ok) {
        const err = await convertResp.json().catch(() => ({ error: `HTTP ${convertResp.status}` }));
        throw new Error(err.error || `Conversion failed: ${convertResp.status}`);
      }

      const { latex } = await convertResp.json();
      setAssignmentContent(sanitizeContent(latex));
      setIsPdf(false);
      setPdfPreviewUri(null);
      setImagePreviewUrl(null);
      setBinaryDownloadUrl(null);
    } catch (e: any) {
      alert("Conversion Error", e.message);
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    fetchAssignment();
    refreshSubmissions();
  }, [fetchAssignment, refreshSubmissions]);

  const handleSave = async () => {
    if (!editTitle.trim()) {
      alert("Error", "Title required");
      return;
    }
    if (editDueDate.trim() && !DATE_PATTERN.test(editDueDate.trim())) {
      alert("Error", "Due date must be YYYY-MM-DD");
      return;
    }

    setSaving(true);
    try {
      const updated = await api<AssignmentDetail>(`/assignments/${assignmentId}`, {
        method: "PATCH",
        body: {
          title: editTitle.trim(),
          due_date: editDueDate.trim() || null,
        },
      });
      setAssignment((prev) => prev ? { ...prev, ...updated } : updated);
      setEditing(false);
      navigation.setOptions({ title: updated.title });
    } catch (e: any) {
      alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReupload = async () => {
    setReuploading(true);
    try {
      const urls = await api<{
        assignment_file_upload_url?: string;
        answer_key_upload_url?: string;
      }>(`/assignments/${assignmentId}/reupload`, { method: "POST" });
      setReuploadUrls(urls);
    } catch (e: any) {
      alert("Error", e.message);
    } finally {
      setReuploading(false);
    }
  };

  const handleOpenFile = (url: string) => {
    Linking.openURL(url);
  };

  if (loading && !refreshing) return <ActivityIndicator size="large" style={{ marginTop: 40 }} color={palette.primary} />;
  if (!assignment) return <Text style={styles.error}>Assignment not found</Text>;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
      }
    >
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, viewMode === "teacher" && styles.modeButtonActive]}
          onPress={() => setViewMode("teacher")}
          accessibilityRole="tab"
          accessibilityLabel="Teacher view"
          accessibilityState={{ selected: viewMode === "teacher" }}
        >
          <Text style={[styles.modeText, viewMode === "teacher" && styles.modeTextActive]}>
            Teacher View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, viewMode === "student" && styles.modeButtonActive]}
          onPress={() => setViewMode("student")}
          accessibilityRole="tab"
          accessibilityLabel="Student view"
          accessibilityState={{ selected: viewMode === "student" }}
        >
          <Text style={[styles.modeText, viewMode === "student" && styles.modeTextActive]}>
            Student View
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === "student" ? (
        /* Student Preview */
        <View>
          <Text style={styles.previewBanner}>Student Preview</Text>
          <Text style={styles.title}>{assignment.title}</Text>
          {assignment.due_date && (
            <Text style={styles.due}>
              Due: {new Date(assignment.due_date).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
              })}
            </Text>
          )}
          {assignmentContent ? (
            <View style={styles.contentPreview}>
              <Text style={styles.sectionTitle}>Problem</Text>
              <LatexRenderer latex={assignmentContent} />
            </View>
          ) : imagePreviewUrl ? (
            <View style={styles.contentPreview}>
              <Text style={styles.sectionTitle}>Problem</Text>
              <Image source={{ uri: imagePreviewUrl }} style={styles.assignmentImage} resizeMode="contain" />
            </View>
          ) : isPdf ? (
            <View>
              {pdfPreviewUri && (
                <Image source={{ uri: pdfPreviewUri }} style={styles.pdfPreview} resizeMode="contain" />
              )}
              <Text style={styles.noContent}>PDF uploaded — convert to LaTeX in Teacher View to preview</Text>
            </View>
          ) : binaryDownloadUrl ? (
            <View style={styles.binaryNotice}>
              <Text style={styles.binaryNoticeText}>This file type cannot be previewed in-app.</Text>
              <TouchableOpacity style={styles.downloadButton} onPress={() => handleOpenFile(binaryDownloadUrl)}>
                <Text style={styles.downloadButtonText}>Download File</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noContent}>No assignment file uploaded</Text>
          )}
          <View style={styles.disabledButton}>
            <Text style={styles.disabledButtonText}>Submit Solution (disabled in preview)</Text>
          </View>
        </View>
      ) : (
        /* Teacher View */
        <View>
          {editing ? (
            <View>
              <Text style={styles.sectionTitle}>Edit Assignment</Text>
              <TextInput
                style={styles.input}
                placeholder="Assignment title"
                value={editTitle}
                onChangeText={setEditTitle}
                accessibilityLabel="Assignment title"
              />
              <DateField
                value={editDueDate}
                onChange={setEditDueDate}
                placeholder="Due date (optional)"
                accessibilityLabel="Due date"
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSave}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={saving ? "Saving" : "Save changes"}
                >
                  <Text style={styles.actionButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setEditing(false);
                    setEditTitle(assignment.title);
                    setEditDueDate(assignment.due_date ? assignment.due_date.split("T")[0] : "");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{assignment.title}</Text>
                <TouchableOpacity
                  style={styles.editChip}
                  onPress={() => setEditing(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit assignment"
                >
                  <Text style={styles.editChipText}>Edit</Text>
                </TouchableOpacity>
              </View>
              {assignment.due_date && (
                <Text style={styles.due}>
                  Due: {new Date(assignment.due_date).toLocaleDateString("en-US", {
                    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                  })}
                </Text>
              )}
            </View>
          )}

          {/* Files Section */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Files</Text>

          <View style={styles.fileCard}>
            <Text style={styles.fileLabel}>Assignment File</Text>
            {assignment.assignment_file_download_url ? (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleOpenFile(assignment.assignment_file_download_url!)}
              >
                <Text style={styles.downloadButtonText}>View / Download</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noFile}>Not uploaded</Text>
            )}
          </View>

          <View style={styles.fileCard}>
            <Text style={styles.fileLabel}>Answer Key</Text>
            {assignment.answer_key_download_url ? (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleOpenFile(assignment.answer_key_download_url!)}
              >
                <Text style={styles.downloadButtonText}>View / Download</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noFile}>Not uploaded</Text>
            )}
          </View>

          {/* Re-upload Section */}
          {!reuploadUrls ? (
            <TouchableOpacity
              style={styles.reuploadButton}
              onPress={handleReupload}
              disabled={reuploading}
            >
              <Text style={styles.reuploadButtonText}>
                {reuploading ? "Preparing..." : "Re-upload Files"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.reuploadSection}>
              {reuploadUrls.assignment_file_upload_url && (
                <>
                  <Text style={styles.sectionTitle}>Replace Assignment File</Text>
                  <FileUploader
                    uploadUrl={reuploadUrls.assignment_file_upload_url}
                    label="Select New Assignment File"
                    onUploadComplete={() => {
                      alert("Success", "Assignment file replaced");
                      setReuploadUrls(null);
                      setLoading(true);
                      fetchAssignment();
                    }}
                  />
                </>
              )}
              {reuploadUrls.answer_key_upload_url && (
                <>
                  <Text style={styles.sectionTitle}>Replace Answer Key</Text>
                  <FileUploader
                    uploadUrl={reuploadUrls.answer_key_upload_url}
                    label="Select New Answer Key"
                    onUploadComplete={() => {
                      alert("Success", "Answer key replaced");
                      setReuploadUrls(null);
                      setLoading(true);
                      fetchAssignment();
                    }}
                  />
                </>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton, { marginTop: 8 }]}
                onPress={() => setReuploadUrls(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel Re-upload</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PDF Conversion */}
          {isPdf && (
            <View style={styles.convertSection}>
              <Text style={styles.sectionTitle}>PDF Detected</Text>
              {pdfPreviewUri && (
                <Image source={{ uri: pdfPreviewUri }} style={styles.pdfPreview} resizeMode="contain" />
              )}
              <Text style={styles.convertHint}>
                Convert the uploaded PDF to LaTeX for in-app math rendering.
              </Text>
              <TouchableOpacity
                style={styles.convertButton}
                onPress={handleConvertPdf}
                disabled={converting}
              >
                {converting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.convertButtonText}>Convert PDF to LaTeX</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Student Submissions</Text>
          {submissionsLoading && !refreshing ? (
            <ActivityIndicator color={palette.primary} />
          ) : submissionsError ? (
            <Text style={styles.errorText}>{submissionsError}</Text>
          ) : submissions.length === 0 ? (
            <View style={styles.emptySubmissions}>
              <Text style={styles.emptySubmissionsTitle}>No submissions yet</Text>
              <Text style={styles.emptySubmissionsSubtitle}>
                Students’ work will appear here after they submit.
              </Text>
            </View>
          ) : (
            submissions.map((submission: Submission) => (
              <View key={submission.id} style={styles.submissionCard}>
                <View style={styles.listItemContent}>
                  <Text style={styles.itemTitle}>
                    {submission.student_display_name ?? `Student ${submission.student_id.slice(0, 8)}`}
                  </Text>
                  <Text style={styles.itemSub}>
                    Submitted {new Date(submission.submitted_at).toLocaleString("en-US", {
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
                    style={styles.downloadButton}
                    onPress={() => handleOpenFile(submission.download_url!)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open submission by ${submission.student_display_name ?? "student"}`}
                  >
                    <Text style={styles.downloadButtonText}>Open</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noFile}>Unavailable</Text>
                )}
              </View>
            ))
          )}

          {/* Content Preview */}
          {assignmentContent && (
            <View style={styles.contentPreview}>
              <Text style={styles.sectionTitle}>Assignment Preview (LaTeX)</Text>
              <LatexRenderer latex={assignmentContent} />
            </View>
          )}
          {imagePreviewUrl && (
            <View style={styles.contentPreview}>
              <Text style={styles.sectionTitle}>Assignment Preview (Image)</Text>
              <Image source={{ uri: imagePreviewUrl }} style={styles.assignmentImage} resizeMode="contain" />
            </View>
          )}
          {binaryDownloadUrl && (
            <View style={styles.binaryNotice}>
              <Text style={styles.binaryNoticeText}>This file type cannot be previewed in-app.</Text>
              <TouchableOpacity style={styles.downloadButton} onPress={() => handleOpenFile(binaryDownloadUrl)}>
                <Text style={styles.downloadButtonText}>Download File</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: palette.card },
  title: { ...typography.h1, flex: 1, color: palette.textPrimary },
  due: { ...typography.bodySmall, color: palette.textMuted, marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: palette.textPrimary },
  error: { textAlign: "center", color: palette.error, marginTop: 40 },
  errorText: { textAlign: "center", color: palette.error, marginTop: 8 },

  modeToggle: { flexDirection: "row", marginBottom: 16, gap: 8 },
  modeButton: {
    flex: 1,
    padding: 10,
    borderRadius: radius.button,
    backgroundColor: palette.tabInactive,
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: palette.primary },
  modeText: { fontWeight: "600", color: palette.textSecondary },
  modeTextActive: { color: palette.white },

  previewBanner: {
    backgroundColor: palette.warningBg,
    color: "#92400E",
    textAlign: "center",
    padding: 8,
    borderRadius: radius.button,
    fontWeight: "600",
    marginBottom: 16,
  },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  editChip: {
    backgroundColor: palette.tabInactive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  editChipText: { fontSize: 13, fontWeight: "600", color: palette.textSecondary },

  input: {
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: radius.input,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  editActions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  actionButton: { flex: 1, padding: 12, borderRadius: radius.button, alignItems: "center" },
  saveButton: { backgroundColor: palette.primary },
  cancelButton: { backgroundColor: palette.tabInactive },
  actionButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  cancelButtonText: { color: palette.textSecondary, fontSize: 16, fontWeight: "600" },

  fileCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.button,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fileLabel: { fontSize: 15, fontWeight: "500", color: palette.textPrimary },
  noFile: { ...typography.caption, color: palette.textDisabled },
  downloadButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  downloadButtonText: { color: palette.white, fontSize: 13, fontWeight: "600" },

  reuploadButton: {
    backgroundColor: palette.warning,
    borderRadius: radius.button,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  reuploadButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  reuploadSection: { marginTop: 16 },

  convertSection: { marginTop: 24, backgroundColor: palette.successBg, borderRadius: radius.button, padding: 16 },
  convertHint: { fontSize: 14, color: palette.textSecondary, marginBottom: 12 },
  convertButton: {
    backgroundColor: "#059669",
    borderRadius: radius.button,
    padding: 14,
    alignItems: "center",
  },
  convertButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  pdfPreview: {
    width: "100%",
    minHeight: 220,
    height: 300,
    borderRadius: radius.button,
    backgroundColor: palette.surface,
    marginBottom: 12,
  },
  assignmentImage: {
    width: "100%",
    minHeight: 220,
    height: 320,
    borderRadius: radius.button,
    backgroundColor: palette.surface,
  },
  binaryNotice: {
    marginTop: 16,
    backgroundColor: "#EFF6FF",
    borderRadius: radius.button,
    padding: 16,
  },
  binaryNoticeText: { fontSize: 14, color: "#1E3A8A", marginBottom: 8 },

  submissionCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.button,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listItemContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: "500", color: palette.textPrimary },
  itemSub: { ...typography.caption, color: palette.textMuted, marginTop: 4 },

  emptySubmissions: { paddingVertical: 24, paddingHorizontal: 16 },
  emptySubmissionsTitle: { fontSize: 16, fontWeight: "600", color: palette.textSecondary, marginBottom: 8 },
  emptySubmissionsSubtitle: { fontSize: 14, color: palette.textMuted },

  contentPreview: { marginTop: 24, flex: 1, minHeight: 300 },
  noContent: { color: palette.textDisabled, textAlign: "center", marginTop: 16 },

  disabledButton: {
    backgroundColor: palette.borderStrong,
    borderRadius: radius.button,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  disabledButtonText: { color: palette.textMuted, fontSize: 16, fontWeight: "600" },
});
