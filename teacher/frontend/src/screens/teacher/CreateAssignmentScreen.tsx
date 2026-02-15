import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, Card, Input, ScreenContainer, Section } from "../../components/ui";
import { LeafAccent } from "../../components/forest";
import { ConfigEditor } from "../../components/ConfigEditor";
import { ConversionProgressModal } from "../../components/ConversionProgressModal";
import { DetectedProblemsPreview, Problem as DetectedProblem } from "../../components/DetectedProblemsPreview";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useToast } from "../../contexts/ToastContext";
import { useCorpus } from "../../hooks/useCorpus";
import { api, apiMultipart } from "../../lib/api";
import { alert } from "../../lib/alert";
import {
  ConversionProgressEvent,
  ConversionSocketHandle,
  openConversionSocket,
} from "../../lib/conversionProgress";
import { generateUuidV4 } from "../../lib/uuid";
import { AssignmentConfig } from "../../types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PickedFile {
  name: string;
  uri: string;
  mimeType: string;
  file?: File;
}

interface NativeMultipartFile {
  uri: string;
  name: string;
  type: string;
}

interface ConversionStatus {
  stage: string;
  progress: number;
  message: string;
  currentPage?: number;
  totalPages?: number;
  connected: boolean;
}

const INITIAL_CONVERSION_STATUS: ConversionStatus = {
  stage: "Preparing conversion...",
  progress: 0,
  message: "Starting conversion pipeline...",
  connected: false,
};

function formatConversionStage(stage: string): string {
  if (stage === "splitting_pages") {
    return "Splitting PDF pages...";
  }
  if (stage === "converting_page") {
    return "Converting pages to LaTeX...";
  }
  if (stage === "detecting_problems") {
    return "Detecting problems...";
  }
  if (stage === "complete") {
    return "Conversion complete";
  }
  if (stage === "error") {
    return "Conversion failed";
  }
  return "Converting file...";
}

function toMultipartFile(file: PickedFile): File | NativeMultipartFile {
  if (file.file) {
    return file.file;
  }
  return {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  };
}

export function CreateAssignmentScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId } = route.params;
  const { showToast } = useToast();
  const { files: corpusFiles, loading: corpusLoading } = useCorpus(classroomId);
  const [selectedContextFiles, setSelectedContextFiles] = useState<string[]>([]);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [configDraft, setConfigDraft] = useState<Partial<AssignmentConfig>>({});
  const classroomConfig: AssignmentConfig | undefined = route.params?.classroomConfig;

  // Quick-create state
  const [converting, setConverting] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>(INITIAL_CONVERSION_STATUS);
  const [conversionFileName, setConversionFileName] = useState<string>("");
  const [detectedProblems, setDetectedProblems] = useState<DetectedProblem[] | null>(null);
  const [convertedAssignmentId, setConvertedAssignmentId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDueDate, setQuickDueDate] = useState("");
  const [quickFile, setQuickFile] = useState<PickedFile | null>(null);
  const [quickAnswerKeyFile, setQuickAnswerKeyFile] = useState<PickedFile | null>(null);

  const pickFile = async (setter: (f: PickedFile) => void) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/*", "image/*", "application/x-tex", "application/x-latex"],
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

  const handleQuickCreate = async () => {
    if (!quickTitle.trim() || !quickFile || !quickDueDate.trim()) return;

    if (!DATE_PATTERN.test(quickDueDate.trim())) {
      alert("Error", "Due date must be in YYYY-MM-DD format");
      return;
    }

    const fileName = quickFile.name.toLowerCase();
    if (!fileName.endsWith(".pdf") && !fileName.endsWith(".tex")) {
      alert("Error", "Please select a PDF or TEX file");
      return;
    }

    const jobId = generateUuidV4();
    let socketHandle: ConversionSocketHandle | null = null;

    setConverting(true);
    setConversionFileName(quickFile.name);
    setConversionStatus(INITIAL_CONVERSION_STATUS);
    try {
      try {
        socketHandle = await openConversionSocket({
          jobId,
          onConnected: (connected) => {
            setConversionStatus((prev) => ({ ...prev, connected }));
          },
          onProgress: (event: ConversionProgressEvent) => {
            setConversionStatus({
              stage: formatConversionStage(event.stage),
              progress: event.progress,
              message: event.message ?? "",
              currentPage: event.current_page,
              totalPages: event.total_pages,
              connected: true,
            });
          },
        });
      } catch {
        setConversionStatus({
          ...INITIAL_CONVERSION_STATUS,
          stage: "Converting file...",
          message: "Live progress unavailable, conversion is still running.",
        });
      }

      const formData = new FormData();
      formData.append("file", toMultipartFile(quickFile) as any);
      formData.append("title", quickTitle.trim());
      formData.append("due_date", quickDueDate.trim());
      formData.append("job_id", jobId);
      if (selectedContextFiles.length > 0) {
        formData.append("context_file_ids", JSON.stringify(selectedContextFiles));
      }
      if (Object.keys(configDraft).length > 0) {
        formData.append("config", JSON.stringify(configDraft));
      }

      const data = await apiMultipart<{ id: string; problems?: DetectedProblem[] }>(
        `/classrooms/${classroomId}/assignments/from-file`,
        formData
      );

      // Upload answer key if provided
      if (quickAnswerKeyFile && data.id) {
        const akFileName = quickAnswerKeyFile.name.toLowerCase();
        if (akFileName.endsWith(".pdf") || akFileName.endsWith(".tex")) {
          const akFormData = new FormData();
          akFormData.append("file", toMultipartFile(quickAnswerKeyFile) as any);
          await apiMultipart(
            `/assignments/${data.id}/convert-answer-key`,
            akFormData
          );
        }
      }

      setDetectedProblems(data.problems || []);
      setConvertedAssignmentId(data.id);
      showToast(`Detected ${data.problems?.length || 0} problems!`);
    } catch (e: unknown) {
      alert("Conversion Failed", e instanceof Error ? e.message : "Failed to convert file");
      setDetectedProblems(null);
      setConvertedAssignmentId(null);
    } finally {
      if (socketHandle) {
        socketHandle.close();
      }
      setConverting(false);
      setConversionFileName("");
      setConversionStatus(INITIAL_CONVERSION_STATUS);
    }
  };

  const handlePublish = async () => {
    if (!convertedAssignmentId) return;

    setPublishing(true);
    try {
      await api(`/assignments/${convertedAssignmentId}/publish`, {
        method: "POST",
      });
      showToast("Assignment published!");
      navigation.goBack();
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to publish assignment");
    } finally {
      setPublishing(false);
    }
  };

  const handleReview = () => {
    if (!convertedAssignmentId) return;
    navigation.navigate("ReviewAssignment", { assignmentId: convertedAssignmentId });
  };

  // Show detected problems preview after successful conversion
  if (detectedProblems && convertedAssignmentId) {
    return (
      <ScreenContainer maxWidth="form">
        <View style={styles.content}>
          <Text style={styles.title}>Review Detected Problems</Text>
          <DetectedProblemsPreview
            problems={detectedProblems}
            onReview={handleReview}
            onPublish={handlePublish}
            isPublishing={publishing}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth="form">
      <ConversionProgressModal
        visible={converting}
        fileName={conversionFileName}
        stage={conversionStatus.stage}
        progress={conversionStatus.progress}
        message={conversionStatus.message}
        currentPage={conversionStatus.currentPage}
        totalPages={conversionStatus.totalPages}
        connected={conversionStatus.connected}
      />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <LeafAccent size={24} />
          <Text style={styles.title}>New Assignment</Text>
        </View>

        <Section title="Create from PDF/TEX">
          <Input
            placeholder="Assignment title"
            value={quickTitle}
            onChangeText={setQuickTitle}
          />
          <Input
            placeholder="Due date (YYYY-MM-DD)"
            value={quickDueDate}
            onChangeText={setQuickDueDate}
          />
          <Card onPress={() => pickFile(setQuickFile)} style={styles.fileCard}>
            <Text style={styles.filePickerText}>
              {quickFile ? quickFile.name : "Select Assignment File (PDF/TEX)"}
            </Text>
          </Card>
          <Card onPress={() => pickFile(setQuickAnswerKeyFile)} style={styles.fileCard}>
            <Text style={styles.filePickerText}>
              {quickAnswerKeyFile ? quickAnswerKeyFile.name : "Select Answer Key (PDF/TEX)"}
            </Text>
          </Card>
        </Section>

        <Section title="Course Texts (optional)">
          <Text style={styles.hint}>
            Select course materials to provide context for mistake analysis.
          </Text>
          {corpusLoading ? (
            <Text style={styles.emptyMessage}>Loading course texts...</Text>
          ) : corpusFiles.length === 0 ? (
            <Text style={styles.emptyMessage}>No course texts uploaded yet</Text>
          ) : (
            <View style={styles.courseTextList}>
              {corpusFiles.map((file) => {
                const isSelected = selectedContextFiles.includes(file.id);
                return (
                  <TouchableOpacity
                    key={file.id}
                    style={[styles.courseTextItem, isSelected && styles.courseTextItemSelected]}
                    onPress={() => {
                      setSelectedContextFiles((prev) =>
                        prev.includes(file.id)
                          ? prev.filter((id) => id !== file.id)
                          : [...prev, file.id]
                      );
                    }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.courseTextName}>{file.display_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
          onPress={handleQuickCreate}
          disabled={!quickTitle.trim() || !quickDueDate.trim() || !quickFile || converting}
          loading={converting}
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.lg },
  title: { ...typography.h1, color: palette.textPrimary },
  fileCard: { marginBottom: spacing.md },
  filePickerText: { ...typography.body, color: palette.textMuted },
  hint: { ...typography.caption, color: palette.textMuted, marginBottom: spacing.sm },
  emptyMessage: {
    ...typography.body,
    color: palette.textMuted,
    fontStyle: "italic",
  },
  courseTextList: {
    gap: spacing.xs,
  },
  courseTextItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: spacing.sm,
  },
  courseTextItemSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryMutedTint,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  checkmark: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  courseTextName: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
  },
  expandToggle: { paddingVertical: spacing.sm, marginBottom: spacing.xs },
  expandToggleText: { ...typography.buttonSmall, color: palette.link },
  configSection: { marginBottom: spacing.md },
  submitButton: { marginTop: spacing.xs },
});
