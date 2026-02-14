import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { uploadFile } from "../lib/upload";
import { alert } from "../lib/alert";

const SAFE_DEFAULT_TYPES = ["application/pdf", "text/*", "image/*"];

interface Props {
  onUploadComplete: (storageUrl: string) => void;
  uploadUrl: string;
  label?: string;
  accept?: string[];
}

export function FileUploader({ onUploadComplete, uploadUrl, label = "Upload File", accept }: Props) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: accept ?? SAFE_DEFAULT_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFileName(file.name);
      setUploading(true);

      const contentType = file.mimeType ?? "application/octet-stream";
      if (contentType === "application/octet-stream") {
        console.error(`FileUploader: unknown MIME type for ${file.name}, using octet-stream`);
      }

      await uploadFile({ uri: file.uri, uploadUrl, mimeType: contentType, file: file.file });
      const storageUrl = uploadUrl.split("?")[0];
      onUploadComplete(storageUrl);
    } catch (e: any) {
      alert("Upload Error", e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handlePick} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </TouchableOpacity>
      {fileName && <Text style={styles.fileName}>{fileName}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  fileName: { marginTop: 8, fontSize: 14, color: "#666", textAlign: "center" },
});
