import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { LatexRenderer } from "../../components/LatexRenderer";
import { FileUploader } from "../../components/FileUploader";
import { AssignmentDetail } from "../../types";

const MAX_CONTENT_LENGTH = 100_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const API_URL = process.env.EXPO_PUBLIC_API_URL ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:5000" : "");

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

function isPdfContent(text: string): boolean {
  return text.startsWith("%PDF") || text.charCodeAt(0) > 127;
}

type ViewMode = "teacher" | "student";

export function TeacherAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { assignmentId } = route.params;
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentContent, setAssignmentContent] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [converting, setConverting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("teacher");

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [reuploadUrls, setReuploadUrls] = useState<{
    assignment_file_upload_url?: string;
    answer_key_upload_url?: string;
  } | null>(null);
  const [reuploading, setReuploading] = useState(false);

  const fetchAssignment = useCallback(async () => {
    try {
      const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
      setAssignment(data);
      setEditTitle(data.title);
      setEditDueDate(data.due_date ? data.due_date.split("T")[0] : "");

      if (data.assignment_file_download_url) {
        const resp = await fetch(data.assignment_file_download_url);
        if (resp.ok) {
          const contentType = resp.headers.get("content-type") ?? "";
          if (contentType.includes("application/pdf")) {
            setIsPdf(true);
            setAssignmentContent(null);
          } else {
            const text = await resp.text();
            if (isPdfContent(text)) {
              setIsPdf(true);
              setAssignmentContent(null);
            } else {
              setIsPdf(false);
              setAssignmentContent(sanitizeContent(text));
            }
          }
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
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
    } catch (e: any) {
      Alert.alert("Conversion Error", e.message);
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchAssignment().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [fetchAssignment]);

  const handleSave = async () => {
    if (!editTitle.trim()) {
      Alert.alert("Error", "Title required");
      return;
    }
    if (editDueDate.trim() && !DATE_PATTERN.test(editDueDate.trim())) {
      Alert.alert("Error", "Due date must be YYYY-MM-DD");
      return;
    }

    setSaving(true);
    try {
      const updated = await api<AssignmentDetail>(`/assignments/${assignmentId}`, {
        method: "PATCH" as any,
        body: {
          title: editTitle.trim(),
          due_date: editDueDate.trim() || null,
        },
      });
      setAssignment((prev) => prev ? { ...prev, ...updated } : updated);
      setEditing(false);
      navigation.setOptions({ title: updated.title });
    } catch (e: any) {
      Alert.alert("Error", e.message);
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
      Alert.alert("Error", e.message);
    } finally {
      setReuploading(false);
    }
  };

  const handleOpenFile = (url: string) => {
    Linking.openURL(url);
  };

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  if (!assignment) return <Text style={styles.error}>Assignment not found</Text>;

  return (
    <ScrollView style={styles.container}>
      {/* View Mode Toggle */}
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
          ) : isPdf ? (
            <Text style={styles.noContent}>PDF uploaded — convert to LaTeX in Teacher View to preview</Text>
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
              />
              <TextInput
                style={styles.input}
                placeholder="Due date (YYYY-MM-DD, optional)"
                value={editDueDate}
                onChangeText={setEditDueDate}
              />
              <View style={styles.editActions}>
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
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{assignment.title}</Text>
                <TouchableOpacity style={styles.editChip} onPress={() => setEditing(true)}>
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
                      Alert.alert("Success", "Assignment file replaced");
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
                      Alert.alert("Success", "Answer key replaced");
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

          {/* Content Preview */}
          {assignmentContent && (
            <View style={styles.contentPreview}>
              <Text style={styles.sectionTitle}>Assignment Preview (LaTeX)</Text>
              <LatexRenderer latex={assignmentContent} />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", flex: 1 },
  due: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  error: { textAlign: "center", color: "#EF4444", marginTop: 40 },

  modeToggle: { flexDirection: "row", marginBottom: 16, gap: 8 },
  modeButton: {
    flex: 1, padding: 10, borderRadius: 8,
    backgroundColor: "#E5E7EB", alignItems: "center",
  },
  modeButtonActive: { backgroundColor: "#4F46E5" },
  modeText: { fontWeight: "600", color: "#374151" },
  modeTextActive: { color: "#fff" },

  previewBanner: {
    backgroundColor: "#FEF3C7", color: "#92400E", textAlign: "center",
    padding: 8, borderRadius: 8, fontWeight: "600", marginBottom: 16,
  },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  editChip: {
    backgroundColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
  },
  editChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },

  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 14, marginBottom: 12, fontSize: 16,
  },
  editActions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  actionButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center" },
  saveButton: { backgroundColor: "#4F46E5" },
  cancelButton: { backgroundColor: "#E5E7EB" },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButtonText: { color: "#374151", fontSize: 16, fontWeight: "600" },

  fileCard: {
    backgroundColor: "#F9FAFB", borderRadius: 8, padding: 14,
    marginBottom: 8, flexDirection: "row", justifyContent: "space-between",
    alignItems: "center",
  },
  fileLabel: { fontSize: 15, fontWeight: "500" },
  noFile: { fontSize: 13, color: "#9CA3AF" },
  downloadButton: {
    backgroundColor: "#4F46E5", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 6,
  },
  downloadButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  reuploadButton: {
    backgroundColor: "#F59E0B", borderRadius: 8, padding: 14,
    alignItems: "center", marginTop: 16,
  },
  reuploadButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  reuploadSection: { marginTop: 16 },

  convertSection: { marginTop: 24, backgroundColor: "#F0FDF4", borderRadius: 8, padding: 16 },
  convertHint: { fontSize: 14, color: "#374151", marginBottom: 12 },
  convertButton: {
    backgroundColor: "#059669", borderRadius: 8, padding: 14,
    alignItems: "center",
  },
  convertButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  contentPreview: { marginTop: 24, flex: 1, minHeight: 300 },
  noContent: { color: "#9CA3AF", textAlign: "center", marginTop: 16 },

  disabledButton: {
    backgroundColor: "#D1D5DB", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 24,
  },
  disabledButtonText: { color: "#6B7280", fontSize: 16, fontWeight: "600" },
});
