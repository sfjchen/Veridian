import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from "react-native";
import { api } from "../../lib/api";
import { LatexRenderer } from "../../components/LatexRenderer";
import { FileUploader } from "../../components/FileUploader";

interface AssignmentDetail {
  id: string;
  title: string;
  prompt_download_url?: string;
  due_date: string | null;
}

export function AssignmentScreen({ route }: { route: any }) {
  const { assignmentId } = route.params;
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptContent, setPromptContent] = useState<string | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<AssignmentDetail>(`/assignments/${assignmentId}`);
        setAssignment(data);
        if (data.prompt_download_url) {
          const resp = await fetch(data.prompt_download_url);
          const text = await resp.text();
          setPromptContent(text);
        }
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId]);

  const handleSubmit = async () => {
    try {
      const result = await api<{ upload_url: string }>(`/assignments/${assignmentId}/submissions`, {
        method: "POST",
      });
      setSubmissionUrl(result.upload_url);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  if (!assignment) return <Text style={styles.error}>Assignment not found</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{assignment.title}</Text>
      {assignment.due_date && (
        <Text style={styles.due}>Due: {new Date(assignment.due_date).toLocaleDateString()}</Text>
      )}
      {promptContent && (
        <View style={styles.promptContainer}>
          <Text style={styles.sectionTitle}>Problem</Text>
          <LatexRenderer latex={promptContent} />
        </View>
      )}
      {!submissionUrl ? (
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Solution</Text>
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
  promptContainer: { flex: 1, marginBottom: 16 },
  submitButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 16,
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { textAlign: "center", color: "#EF4444", marginTop: 40 },
});
