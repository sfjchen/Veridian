import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, Card, Input, ScreenContainer, Section } from "../../components/ui";
import { ConfigEditor } from "../../components/ConfigEditor";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../lib/api";
import { alert } from "../../lib/alert";
import { uploadFile } from "../../lib/upload";
import { AssignmentConfig } from "../../types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PickedFile {
  name: string;
  uri: string;
  mimeType: string;
  file?: File;
}

export function CreateAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<PickedFile | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<PickedFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [configDraft, setConfigDraft] = useState<Partial<AssignmentConfig>>({});
  const classroomConfig: AssignmentConfig | undefined = route.params?.classroomConfig;

  const pickFile = async (setter: (f: PickedFile) => void) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/*", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const picked = result.assets[0];
    setter({
      name: picked.name,
      uri: picked.uri,
      mimeType: picked.mimeType ?? "application/octet-stream",
      file: picked.file,
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      alert("Error", "Title is required");
      return;
    }

    let dueDateValue: string | undefined;
    if (dueDate.trim()) {
      if (!DATE_PATTERN.test(dueDate.trim())) {
        alert("Error", "Due date must be in YYYY-MM-DD format");
        return;
      }
      const parsed = new Date(dueDate.trim());
      if (isNaN(parsed.getTime())) {
        alert("Error", "Invalid date");
        return;
      }
      dueDateValue = dueDate.trim();
    }

    setCreating(true);
    try {
      const body: Record<string, any> = { title: title.trim(), due_date: dueDateValue };
      if (assignmentFile) body.has_assignment_file = true;
      if (answerKeyFile) body.has_answer_key = true;
      if (Object.keys(configDraft).length > 0) {
        body.config = configDraft;
      }
      const result = await api<{
        assignment_file_upload_url: string;
        answer_key_upload_url: string;
      }>(`/classrooms/${classroomId}/assignments`, {
        method: "POST",
        body,
      });

      const uploads: Promise<void>[] = [];
      if (assignmentFile) {
        uploads.push(
          uploadFile({
            uri: assignmentFile.uri,
            uploadUrl: result.assignment_file_upload_url,
            mimeType: assignmentFile.mimeType,
            file: assignmentFile.file,
          })
        );
      }
      if (answerKeyFile) {
        uploads.push(
          uploadFile({
            uri: answerKeyFile.uri,
            uploadUrl: result.answer_key_upload_url,
            mimeType: answerKeyFile.mimeType,
            file: answerKeyFile.file,
          })
        );
      }

      if (uploads.length > 0) await Promise.all(uploads);

      showToast("Assignment created!");
      navigation.goBack();
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to create assignment");
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.content}>
        <Text style={styles.title}>New Assignment</Text>

        <Section title="Details">
          <Input
            placeholder="Assignment title"
            value={title}
            onChangeText={setTitle}
          />
          <Input
            placeholder="Due date (YYYY-MM-DD, optional)"
            value={dueDate}
            onChangeText={setDueDate}
          />
        </Section>

        <Section title="Assignment File (optional)">
          <Card onPress={() => pickFile(setAssignmentFile)} style={styles.fileCard}>
            <Text style={styles.filePickerText}>
              {assignmentFile ? assignmentFile.name : "Select Assignment File"}
            </Text>
          </Card>
        </Section>

        <Section title="Answer Key (optional)">
          <Card onPress={() => pickFile(setAnswerKeyFile)} style={styles.fileCard}>
            <Text style={styles.filePickerText}>
              {answerKeyFile ? answerKeyFile.name : "Select Answer Key"}
            </Text>
          </Card>
        </Section>

        <TouchableOpacity
          style={styles.expandToggle}
          onPress={() => setConfigExpanded(!configExpanded)}
        >
          <Text style={styles.expandToggleText}>
            {configExpanded ? "− Hide Settings" : "+ Assignment Settings"}
          </Text>
        </TouchableOpacity>
        {configExpanded && (
          <View style={styles.configSection}>
            <ConfigEditor
              config={configDraft}
              inheritedConfig={classroomConfig}
              onChange={setConfigDraft}
              mode="assignment"
            />
          </View>
        )}

        <Button
          onPress={handleCreate}
          loading={creating}
          disabled={creating}
          fullWidth
          style={styles.submitButton}
        >
          Create Assignment
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.lg },
  title: { ...typography.h1, color: palette.textPrimary, marginBottom: spacing.lg },
  fileCard: { marginBottom: spacing.md },
  filePickerText: { ...typography.body, color: palette.textMuted },
  expandToggle: { paddingVertical: spacing.sm, marginBottom: spacing.xs },
  expandToggleText: { ...typography.buttonSmall, color: palette.link },
  configSection: { marginBottom: spacing.md },
  submitButton: { marginTop: spacing.xs },
});
