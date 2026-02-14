import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from "react-native";
import { api } from "../../lib/api";
import { LatexRenderer } from "../../components/LatexRenderer";
import { FileUploader } from "../../components/FileUploader";
import { AssignmentDetail } from "../../types";

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
  const [submissionUrl, setSubmissionUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
        if (cancelled) return;
        setAssignment(data);
        if (data.assignment_file_download_url) {
          const resp = await fetch(data.assignment_file_download_url);
          if (!resp.ok) throw new Error(`Failed to fetch assignment file: ${resp.status}`);
          const contentType = resp.headers.get("content-type") ?? "";
          if (contentType.includes("application/pdf")) {
            if (!cancelled) setIsPdf(true);
          } else {
            const text = await resp.text();
            if (cancelled) return;
            if (text.startsWith("%PDF") || text.charCodeAt(0) > 127) {
              setIsPdf(true);
            } else {
              setAssignmentContent(sanitizeLatexContent(text));
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) Alert.alert("Error", e.message);
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
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  if (!assignment) return <Text style={styles.error}>Assignment not found</Text>;

  return (
    <View style={styles.container}>
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
      ) : isPdf ? (
        <View style={styles.pdfNotice}>
          <Text style={styles.pdfNoticeText}>
            This assignment is a PDF. Your teacher will convert it for in-app viewing soon.
          </Text>
          {assignment.assignment_file_download_url && (
            <TouchableOpacity
              style={styles.downloadLink}
              onPress={() => {
                const Linking = require("expo-linking");
                Linking.openURL(assignment.assignment_file_download_url!);
              }}
            >
              <Text style={styles.downloadLinkText}>Download PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {!submissionUrl ? (
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitButtonText}>{submitting ? "Submitting..." : "Submit Solution"}</Text>
        </TouchableOpacity>
      ) : (
        <FileUploader
          uploadUrl={submissionUrl}
          label="Upload Solution"
          onUploadComplete={() => Alert.alert("Success", "Solution submitted!")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold" },
  due: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  assignmentContainer: { flex: 1, marginBottom: 16 },
  submitButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 16,
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { textAlign: "center", color: "#EF4444", marginTop: 40 },
  pdfNotice: {
    backgroundColor: "#FEF3C7", borderRadius: 8, padding: 16, marginBottom: 16,
  },
  pdfNoticeText: { fontSize: 14, color: "#92400E", marginBottom: 8 },
  downloadLink: {
    backgroundColor: "#4F46E5", borderRadius: 6, paddingVertical: 10,
    paddingHorizontal: 16, alignSelf: "flex-start",
  },
  downloadLinkText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
