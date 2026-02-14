import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../../lib/api";
import { alert } from "../../lib/alert";

interface PickedFile {
  name: string;
  uri: string;
  mimeType: string;
}

const ALLOWED_FILE_TYPES = ["pdf", "txt", "docx", "doc", "md", "tex", "rtf"];

function inferFileType(name: string, mimeType: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && ALLOWED_FILE_TYPES.includes(ext)) return ext;
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("text")) return "txt";
  return null;
}

export function CorpusUploadScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const [displayName, setDisplayName] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/x-tex",
        "application/rtf",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const picked = result.assets[0];
    setFile({
      name: picked.name,
      uri: picked.uri,
      mimeType: picked.mimeType ?? "application/octet-stream",
    });
    if (!displayName.trim()) {
      setDisplayName(picked.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!displayName.trim()) {
      alert("Error", "Display name required");
      return;
    }
    if (!file) {
      alert("Error", "Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const fileType = inferFileType(file.name, file.mimeType);
      if (!fileType) {
        alert("Error", "Unsupported file type. Allowed: pdf, txt, docx, doc, md, tex, rtf");
        return;
      }
      const result = await api<{ upload_url: string }>(`/classrooms/${classroomId}/corpus`, {
        method: "POST",
        body: { display_name: displayName.trim(), file_type: fileType },
      });

      const response = await FileSystem.uploadAsync(result.upload_url, file.uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": file.mimeType },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      alert("Success", "File uploaded!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      alert("Error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Corpus File</Text>

      <TouchableOpacity style={styles.filePicker} onPress={pickFile}>
        <Text style={styles.filePickerText}>
          {file ? file.name : "Select File"}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Display name"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <TouchableOpacity
        style={[styles.button, uploading && styles.buttonDisabled]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload File</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 24 },
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
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
