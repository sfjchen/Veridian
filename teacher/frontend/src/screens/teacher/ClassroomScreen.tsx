import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useFocusEffect } from "@react-navigation/native";
import { useCorpus } from "../../hooks/useCorpus";
import { useAssignments } from "../../hooks/useAssignments";
import { useClassroomStudents } from "../../hooks/useClassroomStudents";
import { ScreenContainer } from "../../components/ui";
import { ConfigEditor } from "../../components/ConfigEditor";
import { InsightsContent } from "./InsightsContent";
import { api } from "../../lib/api";
import { Classroom, CorpusFile, AssignmentConfig } from "../../types";
import { palette, radius } from "../../constants/palette";
import { typography } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import { alert } from "../../lib/alert";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { InsightsContent } from "./InsightsContent";

type Tab = "assignments" | "corpus" | "students" | "insights" | "settings";

function formatDueDateLabel(dueDate: string | null): { label: string; warning?: "soon" | "overdue" } {
  if (!dueDate) return { label: "No due date" };
  const d = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const formatted = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (days < 0) return { label: `Due: ${formatted}`, warning: "overdue" };
  if (days <= 2) return { label: `Due: ${formatted}`, warning: "soon" };
  return { label: `Due: ${formatted}` };
}

export function TeacherClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom: Classroom = route.params.classroom;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const [configDraft, setConfigDraft] = useState<Partial<AssignmentConfig>>(classroom.config ?? {});
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [configDraft, setConfigDraft] = useState<Partial<AssignmentConfig>>(classroom.config ?? {});
  const [savingConfig, setSavingConfig] = useState(false);
  const { files, loading: corpusLoading, error: corpusError, refresh: refreshCorpus } = useCorpus(classroom.id);
  const { assignments, loading: assignmentsLoading, error: assignmentsError, refresh: refreshAssignments } = useAssignments(classroom.id);
  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    refresh: refreshStudents,
  } = useClassroomStudents(classroom.id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAssignments(), refreshCorpus(), refreshStudents()]);
    setRefreshing(false);
  }, [refreshAssignments, refreshCorpus, refreshStudents]);

  useFocusEffect(
    useCallback(() => {
      refreshAssignments();
      refreshCorpus();
      refreshStudents();
    }, [refreshAssignments, refreshCorpus, refreshStudents])
  );

  const copyClassCode = async () => {
    try {
      if (Platform.OS === "web" && typeof navigator?.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(classroom.class_code);
      } else {
        await Clipboard.setStringAsync(classroom.class_code);
      }
      alert("Copied", "Class code copied to clipboard.");
    } catch {
      alert("Error", "Could not copy to clipboard.");
    }
  };

  const handleOpenCorpusFile = (file: CorpusFile) => {
    if (file.download_url) Linking.openURL(file.download_url);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await api(`/classrooms/${classroom.id}`, {
        method: "PATCH",
        body: { config: configDraft },
      });
      alert("Success", "Settings saved");
    } catch (e: any) {
      alert("Error", e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingConfig(false);
    }
  };

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
  );

  return (
    <ScreenContainer maxWidth="dashboard">
      <Text style={styles.title}>{classroom.name}</Text>
      <View style={styles.codeRow}>
        <Text style={styles.code}>Class Code: {classroom.class_code}</Text>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={copyClassCode}
          accessibilityRole="button"
          accessibilityLabel="Copy class code"
        >
          <Text style={styles.copyButtonText}>Copy</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(["assignments", "corpus", "students", "insights", "settings"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "assignments" && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id, classroomConfig: classroom.config })}
            accessibilityRole="button"
            accessibilityLabel="New assignment"
          >
            <Text style={styles.addButtonText}>+ New Assignment</Text>
          </TouchableOpacity>
          {assignmentsLoading && !refreshing ? (
            <View style={styles.skeletonList}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : assignmentsError ? (
            <ErrorState message={assignmentsError} onRetry={refreshAssignments} />
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              refreshControl={refreshControl}
              renderItem={({ item }) => {
                const { label, warning } = formatDueDateLabel(item.due_date);
                return (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => navigation.navigate("TeacherAssignment", { assignmentId: item.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}, ${label}`}
                  >
                    <View style={styles.listItemContent}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <View style={styles.dueRow}>
                        <Text style={[styles.itemSub, warning === "overdue" && styles.dueOverdue, warning === "soon" && styles.dueSoon]}>
                          {label}
                        </Text>
                        {warning === "overdue" && <Text style={styles.badgeOverdue}>Overdue</Text>}
                        {warning === "soon" && warning !== "overdue" && (
                          <Text style={styles.badgeSoon}>Due soon</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.chevron}>&gt;</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No assignments yet</Text>
                  <Text style={styles.emptySubtitle}>Add an assignment so students can see and submit work.</Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id, classroomConfig: classroom.config })}
                    accessibilityRole="button"
                    accessibilityLabel="Create first assignment"
                  >
                    <Text style={styles.emptyButtonText}>+ New Assignment</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      )}

      {activeTab === "corpus" && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("CorpusUpload", { classroomId: classroom.id })}
            accessibilityRole="button"
            accessibilityLabel="Upload file to corpus"
          >
            <Text style={styles.addButtonText}>+ Upload File</Text>
          </TouchableOpacity>
          {corpusLoading && !refreshing ? (
            <View style={styles.skeletonList}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : corpusError ? (
            <ErrorState message={corpusError} onRetry={refreshCorpus} />
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              refreshControl={refreshControl}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleOpenCorpusFile(item)}
                  disabled={!item.download_url}
                  accessibilityRole="button"
                  accessibilityLabel={item.download_url ? `Open ${item.display_name}` : `${item.display_name}, unavailable`}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle}>{item.display_name}</Text>
                    <Text style={styles.itemSub}>{item.file_type}</Text>
                  </View>
                  {item.download_url && <Text style={styles.downloadHint}>Open</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No corpus files yet</Text>
                  <Text style={styles.emptySubtitle}>Upload reference files for this classroom.</Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => navigation.navigate("CorpusUpload", { classroomId: classroom.id })}
                    accessibilityRole="button"
                    accessibilityLabel="Upload first file"
                  >
                    <Text style={styles.emptyButtonText}>+ Upload File</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      )}

      {activeTab === "students" && (
        <View style={styles.content}>
          {studentsLoading && !refreshing ? (
            <View style={styles.skeletonList}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : studentsError ? (
            <ErrorState message={studentsError} onRetry={refreshStudents} />
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) => item.student_id}
              refreshControl={refreshControl}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => navigation.navigate("StudentMistakeDetail", {
                    classroomId: classroom.id,
                    studentId: item.student_id,
                    displayName: item.display_name ?? "Student",
                  })}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle}>{item.display_name ?? "Unnamed Student"}</Text>
                    <Text style={styles.itemSub}>
                      Joined{" "}
                      {new Date(item.joined_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No students have joined yet</Text>
                  <Text style={styles.emptySubtitle}>Share the class code with students so they can join.</Text>
                </View>
              }
            />
          )}
        </View>
      )}
      {activeTab === "insights" && (
        <View style={styles.content}>
          <InsightsContent classroomId={classroom.id} navigation={navigation} />
        </View>
      )}

      {activeTab === "settings" && (
        <ScrollView style={styles.content}>
          <Text style={styles.settingsHint}>
            Default settings for all assignments in this classroom.
            Individual assignments can override these.
          </Text>
          <ConfigEditor
            config={configDraft}
            onChange={setConfigDraft}
            mode="classroom"
          />
          <TouchableOpacity
            style={[styles.addButton, savingConfig && { opacity: 0.7 }]}
            onPress={handleSaveConfig}
            disabled={savingConfig}
            accessibilityRole="button"
            accessibilityLabel={savingConfig ? "Saving settings" : "Save settings"}
          >
            <Text style={styles.addButtonText}>
              {savingConfig ? "Saving..." : "Save Settings"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: palette.primaryMuted,
  },
  title: { ...typography.h1, color: palette.textPrimary, flex: 1 },
  tabs: { flexDirection: "row", marginBottom: spacing.md, gap: spacing.xs },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: radius.input,
    backgroundColor: palette.tabInactive,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: palette.primary },
  tabText: { fontWeight: "600", color: palette.textSecondary },
  tabTextActive: { color: palette.white },
  content: { flex: 1 },
  addButton: {
    backgroundColor: palette.success,
    borderRadius: radius.button,
    padding: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  addButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  loader: { marginTop: spacing.md },
  listItem: {
    backgroundColor: palette.card,
    borderRadius: radius.button,
    padding: 14,
    marginBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  emptyIconText: {
    ...typography.h1,
    fontSize: typography.h1.fontSize,
    color: palette.primary,
  },
  empty: { textAlign: "center", color: palette.textDisabled, marginTop: spacing.lg },
  errorText: { textAlign: "center", color: palette.error, marginTop: spacing.lg },
  settingsHint: { ...typography.bodySmall, color: palette.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  emptyWrap: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, alignItems: "center" as const },
  emptyTitle: { ...typography.h2, color: palette.textSecondary, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: palette.textMuted, textAlign: "center" as const },
  emptyButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    padding: spacing.sm,
    alignItems: "center",
    marginTop: spacing.md,
  },
  emptyButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
});
