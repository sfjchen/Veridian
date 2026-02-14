import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { api } from "../../lib/api";
import { FileUploader } from "../../components/FileUploader";

export function CreateAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urls, setUrls] = useState<{ prompt: string; answer_key: string } | null>(null);
  const [promptUploaded, setPromptUploaded] = useState(false);
  const [answerKeyUploaded, setAnswerKeyUploaded] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title required");
      return;
    }
    try {
      const result = await api<{
        prompt_upload_url: string;
        answer_key_upload_url: string;
      }>(`/classrooms/${classroomId}/assignments`, {
        method: "POST",
        body: {
          title: title.trim(),
          due_date: dueDate || undefined,
        },
      });
      setUrls({ prompt: result.prompt_upload_url, answer_key: result.answer_key_upload_url });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const allDone = promptUploaded && answerKeyUploaded;

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
      {!urls ? (
        <TouchableOpacity style={styles.button} onPress={handleCreate}>
          <Text style={styles.buttonText}>Create Assignment</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Upload Prompt</Text>
          <FileUploader
            uploadUrl={urls.prompt}
            label="Select Prompt File"
            onUploadComplete={() => setPromptUploaded(true)}
          />
          <Text style={styles.sectionTitle}>Upload Answer Key</Text>
          <FileUploader
            uploadUrl={urls.answer_key}
            label="Select Answer Key"
            onUploadComplete={() => setAnswerKeyUploaded(true)}
          />
          {allDone && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#10B981", marginTop: 16 }]}
              onPress={() => {
                Alert.alert("Success", "Assignment created!", [
                  { text: "OK", onPress: () => navigation.goBack() },
                ]);
              }}
            >
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8 },
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
