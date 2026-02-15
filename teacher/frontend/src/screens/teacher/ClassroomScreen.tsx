import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useCorpus } from "../../hooks/useCorpus";
import { useAssignments } from "../../hooks/useAssignments";
import { useClassroomStudents } from "../../hooks/useClassroomStudents";
import { useToast } from "../../contexts/ToastContext";
import { ConfigEditor } from "../../components/ConfigEditor";
import { api } from "../../lib/api";
import { alert } from "../../lib/alert";
import { AssignmentConfig, CorpusFile } from "../../types";
import { InsightsContent } from "./InsightsContent";
import {
  Button,
  Card,
  CopyableBadge,
  EmptyState,
  ErrorState,
  ScreenContainer,
  SkeletonCard,
} from "../../components/ui";
import { palette, radius } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

type Tab = "assignments" | "corpus" | "students" | "insights" | "settings";

export function TeacherClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom = route.params.classroom;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
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

  useFocusEffect(
    useCallback(() => {
      refreshAssignments();
      refreshCorpus();
      refreshStudents();
    }, [refreshAssignments, refreshCorpus, refreshStudents])
  );

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await api(`/classrooms/${classroom.id}`, {
        method: "PATCH",
        body: { config: configDraft },
      });
      showToast("Settings saved");
    } catch (e: any) {
      alert("Error", e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenCorpusFile = (file: CorpusFile) => {
    if (file.download_url) Linking.openURL(file.download_url);
  };

  const handleCopyClassCode = useCallback(async () => {
    await Clipboard.setStringAsync(classroom.class_code);
    showToast("Class code copied");
  }, [classroom.class_code, showToast]);

  return (
    <ScreenContainer maxWidth="dashboard">
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{classroom.name}</Text>
        <CopyableBadge text={classroom.class_code} onCopy={() => showToast("Class code copied")} />
      </View>

      <View style={styles.tabs}>
        {(["assignments", "corpus", "students", "insights", "settings"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "assignments" && (
        <View style={styles.content}>
          <Button
            onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id, classroomConfig: classroom.config })}
            variant="primary"
            fullWidth
            style={styles.addButton}
            accessibilityLabel="New assignment"
          >
            + New Assignment
          </Button>
          {assignmentsLoading ? (
            <View style={styles.skeletonWrap}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </View>
          ) : assignmentsError ? (
            <ErrorState message={assignmentsError} onRetry={refreshAssignments} />
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
              }
              renderItem={({ item }) => (
                <Card
                  onPress={() => navigation.navigate("TeacherAssignment", { assignmentId: item.id })}
                  style={styles.listCard}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.itemSub}>
                      {item.due_date
                        ? `Due: ${new Date(item.due_date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}`
                        : "No due date"}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>&gt;</Text>
                </Card>
              )}
              ListEmptyComponent={
                <EmptyState
                  title="No assignments yet"
                  description="Create your first assignment and set a due date."
                  icon={<View style={styles.emptyIcon}><Text style={styles.emptyIconText}>A</Text></View>}
                  actionLabel="New Assignment"
                  onAction={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id })}
                />
              }
            />
          )}
        </View>
      )}

      {activeTab === "corpus" && (
        <View style={styles.content}>
          <Button
            onPress={() => navigation.navigate("CorpusUpload", { classroomId: classroom.id })}
            variant="primary"
            fullWidth
            style={styles.addButton}
            accessibilityLabel="Upload file"
          >
            + Upload File
          </Button>
          {corpusLoading ? (
            <View style={styles.skeletonWrap}>
              <SkeletonCard /><SkeletonCard />
            </View>
          ) : corpusError ? (
            <ErrorState message={corpusError} onRetry={refreshCorpus} />
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
              }
              renderItem={({ item }) => (
                <Card
                  onPress={() => handleOpenCorpusFile(item)}
                  style={styles.listCard}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.display_name}</Text>
                    <Text style={styles.itemSub}>{item.file_type}</Text>
                  </View>
                  {item.download_url ? (
                    <Text style={styles.downloadHint}>Open</Text>
                  ) : null}
                </Card>
              )}
              ListEmptyComponent={
                <EmptyState
                  title="No corpus files yet"
                  description="Upload reference materials for this class."
                  icon={<View style={styles.emptyIcon}><Text style={styles.emptyIconText}>F</Text></View>}
                  actionLabel="Upload File"
                  onAction={() => navigation.navigate("CorpusUpload", { classroomId: classroom.id })}
                />
              }
            />
          )}
        </View>
      )}

      {activeTab === "students" && (
        <View style={styles.content}>
          {studentsLoading ? (
            <View style={styles.skeletonWrap}>
              <SkeletonCard /><SkeletonCard />
            </View>
          ) : studentsError ? (
            <ErrorState message={studentsError} onRetry={refreshStudents} />
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) => item.student_id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
              }
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
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.display_name ?? "Unnamed Student"}</Text>
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
                  <Text style={styles.chevron}>&gt;</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <EmptyState
                  title="No students have joined yet"
                  description="Students join using the class code. Share it with your class."
                  icon={<View style={styles.emptyIcon}><Text style={styles.emptyIconText}>S</Text></View>}
                  actionLabel="Copy class code"
                  onAction={handleCopyClassCode}
                />
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
  tabBar: { flexDirection: "row", marginBottom: spacing.md, gap: spacing.xs },
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
  tabText: { ...typography.bodySmall, fontWeight: "600", color: palette.textSecondary },
  tabTextActive: { ...typography.bodySmall, fontWeight: "600", color: palette.textOnPrimary },
  content: { flex: 1 },
  addButton: { marginBottom: spacing.md },
  skeletonWrap: { paddingBottom: spacing.xl },
  listContent: { paddingBottom: spacing.xl, flexGrow: 1 },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    minHeight: 56,
  },
  listItemContent: { flex: 1, minWidth: 0 },
  itemTitle: { ...typography.body, fontWeight: "500", color: palette.textPrimary },
  itemSub: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xxs },
  chevron: { ...typography.body, color: palette.textMuted, marginLeft: spacing.xs },
  downloadHint: { ...typography.caption, fontWeight: "600", color: palette.link, marginLeft: spacing.xs },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: {
    ...typography.h1,
    fontSize: 24,
    color: palette.primary,
  },
  empty: { textAlign: "center", color: palette.textDisabled, marginTop: spacing.lg },
  errorText: { textAlign: "center", color: palette.error, marginTop: spacing.lg },
  settingsHint: { ...typography.bodySmall, color: palette.textMuted, marginBottom: spacing.md, lineHeight: 18 },
});
