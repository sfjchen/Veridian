import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  ScrollView,
} from "react-native";
import { spacing } from "../../constants/spacing";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useFocusEffect } from "@react-navigation/native";
import { useCorpus } from "../../hooks/useCorpus";
import { useAssignments } from "../../hooks/useAssignments";
import { useClassroomStudents } from "../../hooks/useClassroomStudents";
import { useClassrooms } from "../../hooks/useClassrooms";
import { Classroom, CorpusFile, AssignmentConfig } from "../../types";
import { palette, radius } from "../../constants/palette";
import { typography } from "../../constants/typography";
import { alert } from "../../lib/alert";
import { api } from "../../lib/api";
import { SkeletonCard, StaggeredFade } from "../../components/ui";
import { TabBar } from "../../components/ui/TabBar";
import { TreeIcon } from "../../components/forest";
import { InsightsContent } from "./InsightsContent";
import { ConfigEditor } from "../../components/ConfigEditor";

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
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState<Partial<AssignmentConfig>>(classroom.config ?? {});
  const [saving, setSaving] = useState(false);
  const { files, loading: corpusLoading, error: corpusError, refresh: refreshCorpus } = useCorpus(classroom.id);
  const { assignments, loading: assignmentsLoading, error: assignmentsError, refresh: refreshAssignments } = useAssignments(classroom.id);
  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    refresh: refreshStudents,
  } = useClassroomStudents(classroom.id);
  const { refresh: refreshClassrooms } = useClassrooms();

  useFocusEffect(
    useCallback(() => {
      refreshAssignments();
      refreshCorpus();
      refreshStudents();
    }, [refreshAssignments, refreshCorpus, refreshStudents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAssignments(), refreshCorpus(), refreshStudents()]);
    setRefreshing(false);
  }, [refreshAssignments, refreshCorpus, refreshStudents]);

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
    setSaving(true);
    try {
      await api(`/classrooms/${classroom.id}`, {
        method: "PATCH",
        body: { config },
      });
      alert("Success", "Classroom settings saved.");
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClassroom = () => {
    alert(
      "Delete Classroom",
      `Are you sure you want to delete "${classroom.name}"? This action cannot be undone.`,
      [
        { text: "Cancel" },
        {
          text: "Delete",
          onPress: async () => {
            try {
              await api(`/classrooms/${classroom.id}`, { method: "DELETE" });
              await refreshClassrooms();
              navigation.goBack();
              alert("Deleted", "Classroom deleted successfully.");
            } catch (e: unknown) {
              alert("Error", e instanceof Error ? e.message : "Failed to delete classroom");
            }
          },
        },
      ]
    );
  };

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />
  );

  return (
    <View style={styles.container}>
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

      <View style={styles.tabBarWrap}>
        <TabBar
          options={[
            { key: "assignments", label: "Assignments" },
            { key: "corpus", label: "Course Texts" },
            { key: "students", label: "Students" },
            { key: "insights", label: "Insights" },
            { key: "settings", label: "Settings" },
          ]}
          value={activeTab}
          onChange={(key) => setActiveTab(key as Tab)}
          scrollable
        />
      </View>

      {activeTab === "assignments" && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id })}
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
            <Text style={styles.errorText}>{assignmentsError}</Text>
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              refreshControl={refreshControl}
              renderItem={({ item, index }) => {
                const { label, warning } = formatDueDateLabel(item.due_date);
                return (
                  <StaggeredFade index={index}>
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
                  </StaggeredFade>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}>
                    <TreeIcon size={40} color={palette.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No assignments yet</Text>
                  <Text style={styles.emptySubtitle}>Add an assignment so students can see and submit work.</Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id })}
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
            accessibilityLabel="Upload file to course texts"
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
            <Text style={styles.errorText}>{corpusError}</Text>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              refreshControl={refreshControl}
              renderItem={({ item, index }) => (
                <StaggeredFade index={index}>
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
                </StaggeredFade>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}>
                    <TreeIcon size={40} color={palette.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No course texts yet</Text>
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
            <Text style={styles.errorText}>{studentsError}</Text>
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) => item.student_id}
              refreshControl={refreshControl}
              renderItem={({ item, index }) => (
                <StaggeredFade index={index}>
                  <View style={styles.listItem}>
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
                </View>
                </StaggeredFade>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}>
                    <TreeIcon size={40} color={palette.primary} />
                  </View>
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
          <ConfigEditor config={config} onChange={setConfig} mode="classroom" />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveConfig}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save settings"
          >
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Settings"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteClassroom}
            accessibilityRole="button"
            accessibilityLabel="Delete classroom"
          >
            <Text style={styles.deleteButtonText}>Delete Classroom</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "rgba(255,255,255,0.8)" },
  title: { ...typography.h1, color: palette.textPrimary, marginBottom: 4 },
  codeRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  code: { ...typography.bodySmall, color: palette.textMuted },
  copyButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.button, backgroundColor: palette.tabInactive },
  copyButtonText: { fontSize: 13, fontWeight: "600", color: palette.primary },
  tabBarWrap: { marginBottom: spacing.md },
  content: { flex: 1 },
  addButton: {
    backgroundColor: palette.forestCanopy,
    borderRadius: radius.organic,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  addButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  skeletonList: { marginTop: 8 },
  listItem: {
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  listItemContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: "500", color: palette.textPrimary },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  itemSub: { ...typography.caption, color: palette.textMuted },
  dueOverdue: { color: palette.error },
  dueSoon: { color: palette.warning },
  badgeOverdue: { fontSize: 11, fontWeight: "600", color: palette.error },
  badgeSoon: { fontSize: 11, fontWeight: "600", color: palette.warning },
  chevron: { fontSize: 18, color: palette.textDisabled, marginLeft: 8 },
  downloadHint: { fontSize: 13, color: palette.primary, fontWeight: "600", marginLeft: 8 },
  emptyWrap: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center" },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: palette.textSecondary, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: palette.textMuted, textAlign: "center", marginBottom: 20 },
  emptyButton: {
    backgroundColor: palette.forestCanopy,
    borderRadius: radius.organic,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  errorText: { textAlign: "center", color: palette.error, marginTop: 20 },
  saveButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    padding: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  deleteButton: {
    backgroundColor: palette.error,
    borderRadius: radius.button,
    padding: 14,
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  deleteButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
});
