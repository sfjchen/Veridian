import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
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
import { ProblemEditor } from "../../components/ProblemEditor";
import { DateField } from "../../components/DateField";
import { palette, radius } from "../../constants/palette";
import { typography } from "../../constants/typography";
import { AssignmentConfig, AssignmentDetail, Problem, Submission } from "../../types";
import { alert } from "../../lib/alert";
import {
  Button,
  Card,
  ErrorState,
  Input,
  Row,
  ScreenContainer,
  Section,
} from "../../components/ui";
import { spacing } from "../../constants/spacing";

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
  const [editConfig, setEditConfig] = useState<Partial<AssignmentConfig>>({});
  const [editProblems, setEditProblems] = useState<Problem[]>([]);
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
      setEditConfig(data.config ?? {});
      setEditProblems(data.problems ?? []);
      setAssignmentContent(null);
      setIsPdf(false);
      setPdfPreviewUri(null);
      setImagePreviewUrl(null);
      setBinaryDownloadUrl(null);

      if (data.prompt_latex) {
        setAssignmentContent(sanitizeContent(data.prompt_latex));
      } else if (data.assignment_file_download_url) {
        try {
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
              } catch {
                if (mountedRef.current) {
                  setPdfPreviewUri(null);
                  alert("Warning", "Could not generate PDF preview image");
                }
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
        } catch {
          // File fetch failed (CORS, network, expired URL) — assignment metadata still usable
          console.warn("Could not load assignment file");
        }
      }
    } catch (e: any) {
      if (mountedRef.current) alert("Error", e.message);
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
      if (!mountedRef.current) return;
      if (!pdfResp.ok) throw new Error("Failed to download PDF");
      const blob = await pdfResp.blob();

      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", blob as any, "assignment.pdf");

      const convertResp = await fetch(`${API_URL}/convert/pdf-to-latex?assignment_id=${assignmentId}`, {
        method: "POST",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
        body: formData,
      });
      if (!mountedRef.current) return;

      if (!convertResp.ok) {
        const err = await convertResp.json().catch(() => ({ error: `HTTP ${convertResp.status}` }));
        throw new Error(err.error || `Conversion failed: ${convertResp.status}`);
      }

      const { latex } = await convertResp.json();
      if (!mountedRef.current) return;
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
          config: editConfig,
          problems: editProblems,
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

  if (loading && !refreshing) return (
    <ScreenContainer>
      <ActivityIndicator size="large" style={{ marginTop: spacing.xxl }} color={palette.primary} />
    </ScreenContainer>
  );
  if (!assignment) return (
    <ScreenContainer>
      <Text style={styles.error}>Assignment not found</Text>
    </ScreenContainer>
  );

  return (
    <ScreenContainer maxWidth="dashboard">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1 }}>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, viewMode === "teacher" && styles.modeButtonActive]}
              onPress={() => setViewMode("teacher")}
            >
              <Text style={[styles.modeText, viewMode === "teacher" && styles.modeTextActive]}>
                Teacher View
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, viewMode === "student" && styles.modeButtonActive]}
              onPress={() => setViewMode("student")}
            >
              <Text style={[styles.modeText, viewMode === "student" && styles.modeTextActive]}>
                Student Preview
              </Text>
            </TouchableOpacity>
          </View>

          {viewMode === "student" ? (
            <View>
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
                  <Button size="sm" onPress={() => handleOpenFile(binaryDownloadUrl)}>Download File</Button>
                </View>
              ) : (
                <Text style={styles.noContent}>No assignment file uploaded</Text>
              )}
              <View style={styles.disabledButton}>
                <Text style={styles.disabledButtonText}>Submit Solution (disabled in preview)</Text>
              </View>
              <TouchableOpacity
                style={styles.tryStudentButton}
                onPress={() => navigation.navigate("StudentExperience", { assignmentId })}
              >
                <Text style={styles.tryStudentButtonText}>Try Full Student Experience</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {editing ? (
                <Section title="Edit Assignment">
                  <Input
                    placeholder="Assignment title"
                    value={editTitle}
                    onChangeText={setEditTitle}
                  />
                  <Input
                    placeholder="Due date (YYYY-MM-DD, optional)"
                    value={editDueDate}
                    onChangeText={setEditDueDate}
                  />
                  <Text style={styles.sectionTitle}>Problems</Text>
                  <ProblemEditor problems={editProblems} onChange={setEditProblems} />
                  <Row gap={spacing.sm} style={styles.editActions}>
                    <Button onPress={handleSave} disabled={saving} loading={saving}>
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setEditing(false);
                        setEditTitle(assignment.title);
                        setEditDueDate(assignment.due_date ? assignment.due_date.split("T")[0] : "");
                        setEditProblems(assignment.problems ?? []);
                      }}
                    >
                      Cancel
                    </Button>
                  </Row>
                </Section>
              ) : (
                <View>
                  <Row gap={spacing.sm} style={styles.headerRow}>
                    <Text style={styles.title}>{assignment.title}</Text>
                    <TouchableOpacity style={styles.editChip} onPress={() => setEditing(true)}>
                      <Text style={styles.editChipText}>Edit</Text>
                    </TouchableOpacity>
                  </Row>
                  {assignment.due_date && (
                    <Text style={styles.due}>
                      Due: {new Date(assignment.due_date).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                      })}
                    </Text>
                  )}
                  {(assignment.problems?.length ?? 0) > 0 && (
                    <View style={styles.problemsSummary}>
                      <Text style={styles.sectionTitle}>
                        Problems ({assignment.problems.length})
                      </Text>
                      {assignment.problems.map((p) => (
                        <View key={p.num} style={styles.problemRow}>
                          <Text style={styles.problemNum}>#{p.num}</Text>
                          <Text style={styles.problemTex} numberOfLines={2}>
                            {p.statement_tex || "(no statement)"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Section title="Files">
                <Card style={styles.fileCard}>
                  <Text style={styles.fileLabel}>Assignment File</Text>
                  {assignment.assignment_file_download_url ? (
                    <Button size="sm" onPress={() => handleOpenFile(assignment.assignment_file_download_url!)}>
                      View / Download
                    </Button>
                  ) : (
                    <Text style={styles.noFile}>Not uploaded</Text>
                  )}
                </Card>
                <Card style={styles.fileCard}>
                  <Text style={styles.fileLabel}>Answer Key</Text>
                  {assignment.answer_key_download_url ? (
                    <Button size="sm" onPress={() => handleOpenFile(assignment.answer_key_download_url!)}>
                      View / Download
                    </Button>
                  ) : (
                    <Text style={styles.noFile}>Not uploaded</Text>
                  )}
                </Card>
              </Section>

              {!reuploadUrls ? (
                <Button variant="secondary" onPress={handleReupload} disabled={reuploading} loading={reuploading} style={styles.reuploadButton}>
                  Re-upload Files
                </Button>
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
                  <Button variant="secondary" onPress={() => setReuploadUrls(null)} style={styles.cancelReupload}>
                    Cancel Re-upload
                  </Button>
                </View>
              )}

              {isPdf && (
                <Card style={styles.convertSection}>
                  <Text style={styles.sectionTitle}>PDF Detected</Text>
                  {pdfPreviewUri && (
                    <Image source={{ uri: pdfPreviewUri }} style={styles.pdfPreview} resizeMode="contain" />
                  )}
                  <Text style={styles.convertHint}>
                    Convert the uploaded PDF to LaTeX for in-app math rendering.
                  </Text>
                  <Button onPress={handleConvertPdf} disabled={converting} loading={converting}>
                    Convert PDF to LaTeX
                  </Button>
                </Card>
              )}

              <Section title="Student Submissions">
                {submissionsLoading ? (
                  <ActivityIndicator color={palette.primary} />
                ) : submissionsError ? (
                  <Text style={styles.errorText}>{submissionsError}</Text>
                ) : submissions.length === 0 ? (
                  <Text style={styles.noContent}>No submissions yet</Text>
                ) : (
                  submissions.map((submission: Submission) => (
                    <Card key={submission.id} style={styles.submissionCard}>
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
                        <Button size="sm" onPress={() => handleOpenFile(submission.download_url!)}>
                          Open
                        </Button>
                      ) : (
                        <Text style={styles.noFile}>Unavailable</Text>
                      )}
                    </Card>
                  ))
                )}
              </Section>

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

        </View>
      )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, flex: 1, color: palette.textPrimary },
  due: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xxs, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: spacing.xs, color: palette.textPrimary },
  error: { textAlign: "center", color: palette.error, marginTop: spacing.xxl },
  errorText: { textAlign: "center", color: palette.error, marginTop: spacing.xs },

  modeToggle: { flexDirection: "row", marginBottom: spacing.md, gap: spacing.xs },
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
    color: palette.warningText,
    textAlign: "center",
    padding: 8,
    borderRadius: radius.button,
    fontWeight: "600",
    marginBottom: 16,
  },
  previewBannerText: { ...typography.bodySmall, fontWeight: "600", color: palette.warning },

  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
    marginBottom: spacing.sm,
    fontSize: 16,
  },
  editActions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
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
    backgroundColor: palette.successButton,
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
    backgroundColor: palette.infoBg,
    borderRadius: radius.button,
    padding: 16,
  },
  binaryNoticeText: { fontSize: 14, color: palette.info, marginBottom: 8 },

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

  configFallbackHint: {
    ...typography.caption,
    color: palette.warning,
    backgroundColor: palette.warningBg,
    padding: spacing.xs,
    borderRadius: radius.input,
    marginBottom: spacing.xs,
  },
  configSummary: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xxs,
  },
  configKey: { ...typography.bodySmall, color: palette.textMuted, textTransform: "capitalize" as const },
  configKeyOverridden: { color: palette.primary, fontWeight: "600" as const },
  configValue: { ...typography.bodySmall, fontWeight: "500" as const, color: palette.textSecondary },

  disabledButton: {
    backgroundColor: palette.borderStrong,
    borderRadius: radius.button,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  disabledButtonText: { ...typography.button, color: palette.textMuted },
  tryStudentButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  tryStudentButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  problemsSummary: { marginTop: spacing.md },
  problemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  problemNum: { fontSize: 13, fontWeight: "700", color: "#374151", minWidth: 28 },
  problemTex: { fontSize: 13, color: "#6B7280", flex: 1, fontFamily: "monospace" },
});
