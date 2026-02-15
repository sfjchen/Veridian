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
} from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { API_URL } from "../../lib/apiBaseUrl";
import { createPdfPreviewDataUri, looksLikeImage, looksLikePdf, looksLikeText } from "../../lib/pdfPreview";
import { useToast } from "../../contexts/ToastContext";
import { useSubmissions } from "../../hooks/useSubmissions";
import { LatexRenderer } from "../../components/LatexRenderer";
import { FileUploader } from "../../components/FileUploader";
import { ConfigEditor } from "../../components/ConfigEditor";
import { AssignmentConfig, AssignmentDetail, Submission } from "../../types";
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
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

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
  const { showToast } = useToast();
  const mountedRef = useRef(true);
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [saving, setSaving] = useState(false);

  const [reuploadUrls, setReuploadUrls] = useState<{
    assignment_file_upload_url?: string;
    answer_key_upload_url?: string;
  } | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const {
    submissions,
    loading: submissionsLoading,
    error: submissionsError,
    refresh: refreshSubmissions,
  } = useSubmissions(assignmentId);

  const fetchAssignment = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
      if (!mountedRef.current) return;
      if (!data) {
        setAssignment(null);
        setEditTitle("");
        setEditDueDate("");
        setAssignmentContent(null);
        setIsPdf(false);
        setPdfPreviewUri(null);
        setImagePreviewUrl(null);
        setBinaryDownloadUrl(null);
        setReuploadUrls(null);
        if (mountedRef.current) setLoading(false);
        return;
      }
      setAssignment(data);
      setEditTitle(data.title);
      setEditDueDate(data.due_date ? data.due_date.split("T")[0] : "");
      setEditConfig(data.config ?? {});
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
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setLoadError(e instanceof Error ? e.message : "Failed to load assignment");
      }
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

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
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
          config: editConfig,
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

  if (loading && !assignment) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </ScreenContainer>
    );
  }
  if (loadError && !assignment) {
    return (
      <ScreenContainer>
        <ErrorState message={loadError} onRetry={fetchAssignment} />
      </ScreenContainer>
    );
  }
  if (!assignment) {
    return (
      <ScreenContainer>
        <ErrorState message="Assignment not found" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth="dashboard">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1 }}>
        {viewMode === "teacher" ? (
          <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, viewMode === "teacher" && styles.modeButtonActive]}
            onPress={() => setViewMode("teacher")}
          >
            <Text style={[styles.modeText, viewMode === "teacher" && styles.modeTextActive]}>
              Teacher View
            </Text>
          </TouchableOpacity>
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
            <>
            <View>
              <Text style={styles.sectionTitle}>Edit Assignment</Text>
              <TextInput
                style={styles.input}
                placeholder="Assignment title"
                value={editTitle}
                onChangeText={setEditTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Due date (YYYY-MM-DD, optional)"
                value={editDueDate}
                onChangeText={setEditDueDate}
              />
              <Text style={styles.sectionTitle}>Config Overrides</Text>
              {!assignment.classroom_config && (
                <Text style={styles.configFallbackHint}>
                  Classroom config unavailable; showing platform defaults.
                </Text>
              )}
              <ConfigEditor
                config={editConfig}
                inheritedConfig={assignment.classroom_config}
                onChange={setEditConfig}
                mode="assignment"
              />
              <View style={[styles.editActions, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.actionButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setEditing(false);
                    setEditTitle(assignment.title);
                    setEditDueDate(assignment.due_date ? assignment.due_date.split("T")[0] : "");
                    setEditConfig(assignment.config ?? {});
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.title}>{assignment.title}</Text>
            {assignment.due_date && (
              <Text style={styles.due}>
                Due: {new Date(assignment.due_date).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                })}
              </Text>
            )}
            {assignmentContent && (
              <>
              <View style={styles.contentPreview}>
                <Text style={styles.sectionTitle}>Problem</Text>
                <LatexRenderer latex={assignmentContent} />
              </View>
              {assignment.due_date && (
                <Text style={styles.due}>
                  Due: {new Date(assignment.due_date).toLocaleDateString("en-US", {
                    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                  })}
                </Text>
              )}

              {assignment.resolved_config && (
                <View style={styles.configSummary}>
                  <Text style={styles.sectionTitle}>Active Config</Text>
                  {Object.entries(assignment.resolved_config).map(([key, value]) => {
                    const isOverridden = key in (assignment.config ?? {});
                    return (
                      <View key={key} style={styles.configRow}>
                        <Text style={[styles.configKey, isOverridden && styles.configKeyOverridden]}>
                          {key.replace(/_/g, " ")}
                        </Text>
                        <Text style={styles.configValue}>{String(value)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
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
              <Text style={styles.noContent}>No assignment file uploaded</Text>
            )}
            <View style={styles.disabledButton}>
              <Text style={styles.disabledButtonText}>Submit Solution (disabled in preview)</Text>
            </View>
          </View>
            </>
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
                        showToast("Assignment file replaced");
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
                        showToast("Answer key replaced");
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
              <Card style={styles.binaryNotice}>
                <Text style={styles.binaryNoticeText}>This file type cannot be previewed in-app.</Text>
                <Button size="sm" onPress={() => handleOpenFile(binaryDownloadUrl)}>Download File</Button>
              </Card>
            )}
          </View>
        )}
        </View>
        )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: "center", paddingTop: spacing.xxl },
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xxxl },
  modeToggle: { flexDirection: "row", marginBottom: spacing.md, gap: spacing.xs },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.input,
    backgroundColor: palette.tabInactive,
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: palette.primary },
  modeText: { ...typography.bodySmall, fontWeight: "600", color: palette.textSecondary },
  modeTextActive: { ...typography.bodySmall, fontWeight: "600", color: palette.textOnPrimary },

  previewBanner: {
    backgroundColor: palette.warningBg,
    borderRadius: radius.input,
    padding: spacing.xs,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  previewBannerText: { ...typography.bodySmall, fontWeight: "600", color: "#92400E" },

  title: { ...typography.h1, color: palette.textPrimary, flex: 1 },
  due: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xxs, marginBottom: spacing.md },
  sectionTitle: { ...typography.body, fontWeight: "600", color: palette.textPrimary, marginBottom: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs },
  editChip: {
    backgroundColor: palette.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
  },
  editChipText: { ...typography.caption, fontWeight: "600", color: palette.textSecondary },

  editActions: { marginBottom: spacing.md },

  fileCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  fileLabel: { ...typography.body, fontWeight: "500", color: palette.textPrimary },
  noFile: { ...typography.caption, color: palette.textMuted },
  reuploadButton: { marginTop: spacing.md },
  reuploadSection: { marginTop: spacing.md },
  cancelReupload: { marginTop: spacing.xs },

  convertSection: { marginTop: spacing.lg, backgroundColor: palette.successBg },
  convertHint: { ...typography.bodySmall, color: palette.textSecondary, marginBottom: spacing.sm },

  pdfPreview: {
    width: "100%",
    minHeight: 220,
    height: 300,
    borderRadius: radius.input,
    backgroundColor: palette.border,
    marginBottom: spacing.sm,
  },
  assignmentImage: {
    width: "100%",
    minHeight: 220,
    height: 320,
    borderRadius: radius.input,
    backgroundColor: palette.border,
  },
  binaryNotice: { marginTop: spacing.md, backgroundColor: palette.surface },
  binaryNoticeText: { ...typography.bodySmall, color: palette.textSecondary, marginBottom: spacing.xs },

  submissionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  listItemContent: { flex: 1 },
  itemTitle: { ...typography.body, fontWeight: "500", color: palette.textPrimary },
  itemSub: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xxs },

  contentPreview: { marginTop: spacing.lg, minHeight: 300 },
  noContent: { ...typography.body, color: palette.textMuted, textAlign: "center", marginTop: spacing.md },
  errorText: { ...typography.body, color: palette.error, textAlign: "center", marginTop: spacing.xs },

  configFallbackHint: {
    fontSize: 12, color: "#92400E", backgroundColor: "#FEF3C7",
    padding: 8, borderRadius: 6, marginBottom: 8,
  },
  configSummary: {
    backgroundColor: "#F9FAFB", borderRadius: 8, padding: 14, marginBottom: 16,
  },
  configRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4,
  },
  configKey: { fontSize: 13, color: "#6B7280", textTransform: "capitalize" },
  configKeyOverridden: { color: "#4F46E5", fontWeight: "600" },
  configValue: { fontSize: 13, fontWeight: "500", color: "#374151" },

  disabledButton: {
    backgroundColor: palette.border,
    borderRadius: radius.button,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  disabledButtonText: { color: "#6B7280", fontSize: 16, fontWeight: "600" },
  tryStudentButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 12,
  },
  tryStudentButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
