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
import { spacing } from "../../constants/spacing";
import { AssignmentDetail, Submission } from "../../types";
import { alert } from "../../lib/alert";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";

const MAX_CONTENT_LENGTH = 100_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDueDateLabel(dueDate: string | null): { label: string; warning?: "soon" | "overdue" } {
  if (!dueDate) return { label: "No due date" };
  const d = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const formatted = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (days < 0) return { label: `Due: ${formatted}`, warning: "overdue" };
  if (days <= 2) return { label: `Due: ${formatted}`, warning: "soon" };
  return { label: `Due: ${formatted}` };
}

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

type FilePreviewState = {
  isPdf: boolean;
  pdfPreviewUri: string | null;
  imagePreviewUrl: string | null;
  assignmentContent: string | null;
  binaryDownloadUrl: string | null;
};

async function processAssignmentFile(url: string, mountedRef: React.MutableRefObject<boolean>): Promise<FilePreviewState | null> {
  const resp = await fetch(url);
  if (!mountedRef.current || !resp.ok) return null;

  const blob = await resp.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!mountedRef.current) return null;

  const contentType = resp.headers.get("content-type") ?? "";

  if (looksLikePdf(contentType, bytes)) {
    let pdfPreviewUri = null;
    try {
      pdfPreviewUri = await createPdfPreviewDataUri(blob);
    } catch (previewError) {
      console.error("Failed to generate PDF preview image:", previewError);
    }
    return { isPdf: true, pdfPreviewUri, imagePreviewUrl: null, assignmentContent: null, binaryDownloadUrl: null };
  }

  if (looksLikeImage(contentType, bytes)) {
    return { isPdf: false, pdfPreviewUri: null, imagePreviewUrl: url, assignmentContent: null, binaryDownloadUrl: null };
  }

  if (looksLikeText(contentType, bytes)) {
    const text = await blob.text();
    if (!mountedRef.current) return null;
    return { isPdf: false, pdfPreviewUri: null, imagePreviewUrl: null, assignmentContent: sanitizeContent(text), binaryDownloadUrl: null };
  }

  return { isPdf: false, pdfPreviewUri: null, imagePreviewUrl: null, assignmentContent: null, binaryDownloadUrl: url };
}

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
        const preview = await processAssignmentFile(data.assignment_file_download_url, mountedRef);
        if (mountedRef.current && preview) {
          setIsPdf(preview.isPdf);
          setPdfPreviewUri(preview.pdfPreviewUri);
          setImagePreviewUrl(preview.imagePreviewUrl);
          setAssignmentContent(preview.assignmentContent);
          setBinaryDownloadUrl(preview.binaryDownloadUrl);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load assignment";
      if (mountedRef.current) alert("Error", message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [assignmentId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAssignment(), refreshSubmissions()]);
    if (mountedRef.current) setRefreshing(false);
  }, [fetchAssignment, refreshSubmissions]);

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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Conversion failed";
      alert("Conversion Error", message);
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      alert("Error", message);
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to prepare re-upload";
      alert("Error", message);
    } finally {
      setReuploading(false);
    }
  };

  const handleOpenFile = (url: string) => {
    Linking.openURL(url);
  };

  if (loading && !refreshing) {
    return (
      <ScreenContainer maxWidth="dashboard">
        <View style={styles.loadingWrap}>
          <Skeleton height={28} width="70%" style={{ marginBottom: spacing.sm }} />
          <Skeleton height={14} width="40%" style={{ marginBottom: spacing.lg }} />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </ScreenContainer>
    );
  }
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
          {assignment.due_date && (() => {
            const { label, warning } = formatDueDateLabel(assignment.due_date);
            return (
              <View style={styles.dueRow}>
                <Text style={[styles.due, warning === "overdue" && styles.dueOverdue, warning === "soon" && styles.dueSoon]}>{label}</Text>
                {warning === "overdue" && <Text style={styles.badgeOverdue}>Overdue</Text>}
                {warning === "soon" && <Text style={styles.badgeSoon}>Due soon</Text>}
              </View>
            );
          })()}
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
              {assignment.due_date && (() => {
                const { label, warning } = formatDueDateLabel(assignment.due_date);
                return (
                  <View style={styles.dueRow}>
                    <Text style={[styles.due, warning === "overdue" && styles.dueOverdue, warning === "soon" && styles.dueSoon]}>{label}</Text>
                    {warning === "overdue" && <Text style={styles.badgeOverdue}>Overdue</Text>}
                    {warning === "soon" && <Text style={styles.badgeSoon}>Due soon</Text>}
                  </View>
                );
              })()}
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
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Text style={styles.convertButtonText}>Convert PDF to LaTeX</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Student Submissions</Text>
          {submissionsLoading && !refreshing ? (
            <View style={styles.submissionsSkeleton}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : submissionsError ? (
            <ErrorState message={submissionsError} onRetry={refreshSubmissions} />
          ) : submissions.length === 0 ? (
            <EmptyState
              title="No submissions yet"
              description="Students’ work will appear here after they submit."
            />
          ) : (
            submissions.map((submission: Submission) => {
              const displayName = submission.student_display_name ?? `Student ${submission.student_id.slice(0, 8)}`;
              return (
                <View key={submission.id} style={styles.submissionCard}>
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle}>{displayName}</Text>
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
                  <View style={styles.submissionActions}>
                    {assignment.classroom_id && (
                      <TouchableOpacity
                        style={styles.analysisLink}
                        onPress={() => navigation.navigate("StudentMistakeDetail", {
                          classroomId: assignment.classroom_id,
                          studentId: submission.student_id,
                          displayName,
                        })}
                        accessibilityRole="button"
                        accessibilityLabel={`View analysis for ${displayName}`}
                      >
                        <Text style={styles.analysisLinkText}>View analysis</Text>
                      </TouchableOpacity>
                    )}
                    {submission.download_url ? (
                      <TouchableOpacity
                        style={styles.downloadButton}
                        onPress={() => handleOpenFile(submission.download_url!)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open submission by ${displayName}`}
                      >
                        <Text style={styles.downloadButtonText}>Open</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.noFile}>Unavailable</Text>
                    )}
                  </View>
                </View>
              );
            })
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
  dueRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginBottom: 16, flexWrap: "wrap" as const },
  dueOverdue: { color: palette.error },
  dueSoon: { color: palette.warning },
  badgeOverdue: { ...typography.caption, fontWeight: "600" as const, color: palette.error, marginLeft: 4 },
  badgeSoon: { ...typography.caption, fontWeight: "600" as const, color: palette.warning, marginLeft: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: palette.textPrimary },
  error: { textAlign: "center", color: palette.error, marginTop: 40 },
  errorText: { textAlign: "center", color: palette.error, marginTop: 8 },
  loadingWrap: { paddingTop: spacing.xxl },
  submissionsSkeleton: { marginTop: spacing.xs },

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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  listItemContent: { flex: 1, marginRight: spacing.sm },
  itemTitle: { fontSize: 16, fontWeight: "500" as const, color: palette.textPrimary },
  itemSub: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
  submissionActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
  analysisLink: { paddingVertical: 6, paddingHorizontal: 10 },
  analysisLinkText: { ...typography.caption, fontWeight: "600" as const, color: palette.primary },

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
