import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { uploadFile } from "../lib/upload";
import { alert } from "../lib/alert";
import { Button } from "./ui";
import { palette } from "../constants/palette";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

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
    } catch (e: unknown) {
      alert("Upload Error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button onPress={handlePick} loading={uploading} disabled={uploading}>
        {label}
      </Button>
      {fileName ? <Text style={styles.fileName}>{fileName}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: spacing.xs },
  fileName: { marginTop: spacing.xs, ...typography.bodySmall, color: palette.textMuted, textAlign: "center" },
});
