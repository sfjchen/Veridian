import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../lib/api";
import { alert } from "../../lib/alert";
import { uploadFile } from "../../lib/upload";
import { Button, Card, Input, ScreenContainer, Section } from "../../components/ui";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface PickedFile {
  name: string;
  uri: string;
  mimeType: string;
  file?: File;
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
  const { showToast } = useToast();
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
      file: picked.file,
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
    const fileType = inferFileType(file.name, file.mimeType);
    if (!fileType) {
      alert("Error", "Unsupported file type. Allowed: pdf, txt, docx, doc, md, tex, rtf");
      return;
    }

    setUploading(true);
    try {
      const result = await api<{ upload_url: string }>(`/classrooms/${classroomId}/corpus`, {
        method: "POST",
        body: { display_name: displayName.trim(), file_type: fileType },
      });

      await uploadFile({
        uri: file.uri,
        uploadUrl: result.upload_url,
        mimeType: file.mimeType,
        file: file.file,
      });

      showToast("File uploaded!");
      navigation.goBack();
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.content}>
        <Section title="Upload Corpus File">
          <Card onPress={pickFile} style={styles.fileCard}>
            <Text style={styles.filePickerText}>
              {file ? file.name : "Select File"}
            </Text>
          </Card>
          <Input
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </Section>

        <Button onPress={handleUpload} loading={uploading} disabled={uploading} fullWidth>
          Upload File
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.lg },
  fileCard: { marginBottom: spacing.md },
  filePickerText: { ...typography.body, color: palette.textMuted },
});
