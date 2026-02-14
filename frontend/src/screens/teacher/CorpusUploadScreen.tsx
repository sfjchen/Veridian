import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { api } from "../../lib/api";
import { FileUploader } from "../../components/FileUploader";

export function CorpusUploadScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const [displayName, setDisplayName] = useState("");
  const [fileType, setFileType] = useState("");
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateRecord = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name required");
      return;
    }
    if (!fileType.trim()) {
      Alert.alert("Error", "File type required");
      return;
    }
    setLoading(true);
    try {
      const result = await api<{ upload_url: string }>(`/classrooms/${classroomId}/corpus`, {
        method: "POST",
        body: { display_name: displayName.trim(), file_type: fileType.trim() },
      });
      setUploadUrl(result.upload_url);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Corpus File</Text>
      <TextInput
        style={styles.input}
        placeholder="File display name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="File type (e.g., pdf, tex, docx)"
        value={fileType}
        onChangeText={setFileType}
      />
      {!uploadUrl ? (
        <TouchableOpacity style={styles.button} onPress={handleCreateRecord} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Creating..." : "Get Upload URL"}</Text>
        </TouchableOpacity>
      ) : (
        <FileUploader
          uploadUrl={uploadUrl}
          label="Select & Upload File"
          onUploadComplete={() => {
            Alert.alert("Success", "File uploaded!", [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          }}
        />
      )}
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
  button: {
    backgroundColor: "#4F46E5", borderRadius: 8, padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
