import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { api } from "../../lib/api";
import { FileUploader } from "../../components/FileUploader";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function CreateAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urls, setUrls] = useState<{ assignment_file: string; answer_key: string } | null>(null);
  const [assignmentFileUploaded, setAssignmentFileUploaded] = useState(false);
  const [answerKeyUploaded, setAnswerKeyUploaded] = useState(false);
  const [creating, setCreating] = useState(false);

  const allDone = assignmentFileUploaded && answerKeyUploaded;

  useEffect(() => {
    if (allDone) {
      Alert.alert("Success", "Assignment created!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [allDone, navigation]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title required");
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
        body: {
          title: title.trim(),
          due_date: dueDateValue,
        },
      });
      setUrls({ assignment_file: result.assignment_file_upload_url, answer_key: result.answer_key_upload_url });
    } catch (e: any) {
      Alert.alert("Error", e.message);
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
      {!urls ? (
        <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={creating}>
          <Text style={styles.buttonText}>{creating ? "Creating..." : "Create Assignment"}</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Upload Assignment File</Text>
          <FileUploader
            uploadUrl={urls.assignment_file}
            label="Select Assignment File"
            onUploadComplete={() => setAssignmentFileUploaded(true)}
          />
          <Text style={styles.sectionTitle}>Upload Answer Key</Text>
          <FileUploader
            uploadUrl={urls.answer_key}
            label="Select Answer Key"
            onUploadComplete={() => setAnswerKeyUploaded(true)}
          />
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
