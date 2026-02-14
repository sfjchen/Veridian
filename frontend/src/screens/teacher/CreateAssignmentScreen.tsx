import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../../lib/api";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PickedFile {
  name: string;
  uri: string;
  mimeType: string;
}

export function CreateAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<PickedFile | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<PickedFile | null>(null);
  const [creating, setCreating] = useState(false);

  const pickFile = async (setter: (f: PickedFile) => void) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/*", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    setter({
      name: file.name,
      uri: file.uri,
      mimeType: file.mimeType ?? "application/octet-stream",
    });
  };

  const uploadFile = async (uri: string, uploadUrl: string, mimeType: string) => {
    const response = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": mimeType },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }

    let dueDateValue: string | undefined;
    if (dueDate.trim()) {
      if (!DATE_PATTERN.test(dueDate.trim())) {
        Alert.alert("Error", "Due date must be in YYYY-MM-DD format");
        return;
      }
      const parsed = new Date(dueDate.trim());
      if (isNaN(parsed.getTime())) {
        Alert.alert("Error", "Invalid date");
        return;
      }
      dueDateValue = dueDate.trim();
    }

    setCreating(true);
    try {
      const result = await api<{
        assignment_file_upload_url: string;
        answer_key_upload_url: string;
      }>(`/classrooms/${classroomId}/assignments`, {
        method: "POST",
        body: { title: title.trim(), due_date: dueDateValue },
      });

      const uploads: Promise<void>[] = [];
      if (assignmentFile) {
        uploads.push(uploadFile(assignmentFile.uri, result.assignment_file_upload_url, assignmentFile.mimeType));
      }
      if (answerKeyFile) {
        uploads.push(uploadFile(answerKeyFile.uri, result.answer_key_upload_url, answerKeyFile.mimeType));
      }

      if (uploads.length > 0) {
        await Promise.all(uploads);
      }

      Alert.alert("Success", "Assignment created!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create assignment");
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>New Assignment</Text>

      <TextInput
        style={styles.input}
        placeholder="Assignment title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Due date (YYYY-MM-DD, optional)"
        value={dueDate}
        onChangeText={setDueDate}
      />

      <Text style={styles.sectionTitle}>Assignment File (optional)</Text>
      <TouchableOpacity style={styles.filePicker} onPress={() => pickFile(setAssignmentFile)}>
        <Text style={styles.filePickerText}>
          {assignmentFile ? assignmentFile.name : "Select Assignment File"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Answer Key (optional)</Text>
      <TouchableOpacity style={styles.filePicker} onPress={() => pickFile(setAnswerKeyFile)}>
        <Text style={styles.filePickerText}>
          {answerKeyFile ? answerKeyFile.name : "Select Answer Key"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, creating && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Assignment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 14, marginBottom: 16, fontSize: 16,
  },
  filePicker: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 14, marginBottom: 16, backgroundColor: "#F9FAFB",
  },
  filePickerText: { fontSize: 15, color: "#6B7280" },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
