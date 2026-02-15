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
  Modal,
} from "react-native";
import { spacing } from "../../constants/spacing";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCorpus } from "../../hooks/useCorpus";
import { useAssignments } from "../../hooks/useAssignments";
import { useClassroomStudents } from "../../hooks/useClassroomStudents";
import { useClassrooms } from "../../hooks/useClassrooms";
import { Classroom, CorpusFile, AssignmentConfig } from "../../types";
import { palette, radius, elevation } from "../../constants/palette";
import { typography } from "../../constants/typography";
import { alert } from "../../lib/alert";
import { api } from "../../lib/api";
import { SkeletonCard, StaggeredFade } from "../../components/ui";
import { ClassroomSection, ClassroomSidebar } from "../../components/ClassroomSidebar";
import { TreeIcon } from "../../components/forest";
import { InsightsContent } from "./InsightsContent";
import { ConfigEditor } from "../../components/ConfigEditor";
import { PathSectionHeader } from "../../components/PathSectionHeader";

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

const SECTION_META: Record<
  ClassroomSection,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; subtitle: string; cta: string }
> = {
  insights: {
    icon: "sprout",
    title: "Canopy Insights",
    subtitle: "Track class growth, stress clusters, and where to prune misconceptions.",
    cta: "",
  },
  assignments: {
    icon: "book-open-page-variant-outline",
    title: "Assignments Path",
    subtitle: "Plant new work and monitor which tasks need extra sunlight.",
    cta: "Plant New Assignment",
  },
  corpus: {
    icon: "file-document-outline",
    title: "Course Texts Path",
    subtitle: "Feed the classroom with references, worked examples, and source material.",
    cta: "Add Nutrients (Upload Text)",
  },
  students: {
    icon: "account-group-outline",
    title: "Students Grove",
    subtitle: "Check individual growth patterns and intervene before confusion spreads.",
    cta: "Check Growth by Student",
  },
};

export function TeacherClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom: Classroom = route.params.classroom;
  const [activeSection, setActiveSection] = useState<ClassroomSection>("insights");
  const [showSectionSheet, setShowSectionSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    if (!file.download_url) return;
    alert(
      file.display_name,
      `Type: ${file.file_type}\nUploaded to this classroom's course texts.`,
      [
        { text: "Close" },
        {
          text: "Download",
          onPress: () => Linking.openURL(file.download_url!),
        },
      ]
    );
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
              console.error('Delete classroom failed:', e);
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
  const assignmentColumns = Platform.OS === "web" ? 4 : 1;
  const corpusColumns = Platform.OS === "web" ? 3 : 1;
  const studentColumns = Platform.OS === "web" ? 3 : 1;
  const isDesktopLayout = Platform.OS === "web";
  const assignmentsNeedingAttention = assignments.filter((assignment) => {
    const due = assignment.due_date ? new Date(assignment.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    return due < Date.now();
  }).length;
  const gardenMood: "healthy" | "watch" | "critical" =
    assignmentsNeedingAttention > 3 ? "critical" : assignmentsNeedingAttention > 0 ? "watch" : "healthy";

  const renderAssignments = () => (
    <View style={styles.content}>
      <PathSectionHeader
        icon={SECTION_META.assignments.icon}
        title={SECTION_META.assignments.title}
        subtitle={SECTION_META.assignments.subtitle}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id })}
        accessibilityRole="button"
        accessibilityLabel={SECTION_META.assignments.cta}
      >
        <Text style={styles.addButtonText}>+ {SECTION_META.assignments.cta}</Text>
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
          key={`assignments-${assignmentColumns}`}
          numColumns={assignmentColumns}
          columnWrapperStyle={assignmentColumns > 1 ? styles.assignmentColumnWrap : undefined}
          refreshControl={refreshControl}
          renderItem={({ item, index }) => {
            const { label, warning } = formatDueDateLabel(item.due_date);
            return (
              <View style={[styles.assignmentCell, assignmentColumns > 1 && styles.assignmentCellGrid]}>
                <StaggeredFade index={index}>
                  <TouchableOpacity
                    style={styles.assignmentCard}
                    onPress={() => navigation.navigate("TeacherAssignment", { assignmentId: item.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}, ${label}`}
                  >
                    <View style={styles.assignmentCardAccent} />
                    <View style={styles.assignmentCardBody}>
                      <View style={styles.assignmentHeaderRow}>
                        <Text style={styles.itemTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.assignmentOpenHint}>Open</Text>
                      </View>
                      <View style={styles.assignmentMeta}>
                        <Text
                          style={[
                            styles.itemSub,
                            warning === "overdue" && styles.dueOverdue,
                            warning === "soon" && styles.dueSoon,
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        {warning === "overdue" && <Text style={styles.badgeOverdue}>Overdue</Text>}
                        {warning === "soon" && (
                          <Text style={styles.badgeSoon}>Due soon</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </StaggeredFade>
              </View>
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
  );

  const renderCorpus = () => (
    <View style={styles.content}>
      <PathSectionHeader
        icon={SECTION_META.corpus.icon}
        title={SECTION_META.corpus.title}
        subtitle={SECTION_META.corpus.subtitle}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("CorpusUpload", { classroomId: classroom.id })}
        accessibilityRole="button"
        accessibilityLabel={SECTION_META.corpus.cta}
      >
        <Text style={styles.addButtonText}>+ {SECTION_META.corpus.cta}</Text>
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
          key={`corpus-${corpusColumns}`}
          numColumns={corpusColumns}
          columnWrapperStyle={corpusColumns > 1 ? styles.cardColumnWrap : undefined}
          refreshControl={refreshControl}
          renderItem={({ item, index }) => {
            const isOpenable = Boolean(item.download_url);
            return (
              <View style={[styles.cardCell, corpusColumns > 1 && styles.cardCellGrid]}>
                <StaggeredFade index={index}>
                  <TouchableOpacity
                    style={[styles.corpusCard, !isOpenable && styles.corpusCardDisabled]}
                    onPress={() => handleOpenCorpusFile(item)}
                    disabled={!isOpenable}
                    accessibilityRole="button"
                    accessibilityLabel={isOpenable ? `Open ${item.display_name}` : `${item.display_name}, unavailable`}
                  >
                    <View style={styles.corpusCardTop}>
                      <Text style={styles.itemTitle} numberOfLines={2}>
                        {item.display_name}
                      </Text>
                      <View style={styles.fileTypeChip}>
                        <Text style={styles.fileTypeChipText}>{item.file_type.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.corpusCardBottom}>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        Course resource
                      </Text>
                      <Text style={[styles.downloadHint, !isOpenable && styles.downloadHintDisabled]}>
                        {isOpenable ? "Open" : "Unavailable"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </StaggeredFade>
              </View>
            );
          }}
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
  );

  const renderStudents = () => (
    <View style={styles.content}>
      <PathSectionHeader
        icon={SECTION_META.students.icon}
        title={SECTION_META.students.title}
        subtitle={SECTION_META.students.subtitle}
      />
      <View style={styles.studentsHintCard}>
        <Text style={styles.studentsHintTitle}>Tend this grove</Text>
        <Text style={styles.studentsHintCopy}>
          Open any learner to inspect submissions and prune recurring mistakes early.
        </Text>
      </View>
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
          key={`students-${studentColumns}`}
          numColumns={studentColumns}
          columnWrapperStyle={studentColumns > 1 ? styles.cardColumnWrap : undefined}
          refreshControl={refreshControl}
          renderItem={({ item, index }) => (
            <View style={[styles.cardCell, studentColumns > 1 && styles.cardCellGrid]}>
              <StaggeredFade index={index}>
                <TouchableOpacity
                  style={styles.studentCard}
                  onPress={() =>
                    navigation.navigate("StudentSubmissions", {
                      classroomId: classroom.id,
                      studentId: item.student_id,
                      studentDisplayName: item.display_name ?? "Unnamed Student",
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`View submissions for ${item.display_name ?? "Unnamed Student"}`}
                >
                  <View style={styles.studentAvatar}>
                    <MaterialCommunityIcons name="sprout" size={16} color={palette.forestCanopy} />
                  </View>
                  <View style={styles.studentCardBody}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.display_name ?? "Unnamed Student"}
                    </Text>
                    <Text style={styles.itemSub}>
                      Joined{" "}
                      {new Date(item.joined_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </Text>
                    <Text style={styles.studentActionHint}>Open Growth Profile</Text>
                  </View>
                </TouchableOpacity>
              </StaggeredFade>
            </View>
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
  );

  const renderActiveSection = () => {
    if (activeSection === "assignments") return renderAssignments();
    if (activeSection === "corpus") return renderCorpus();
    if (activeSection === "students") return renderStudents();
    return (
      <View style={styles.content}>
        <PathSectionHeader
          icon={SECTION_META.insights.icon}
          title={SECTION_META.insights.title}
          subtitle={SECTION_META.insights.subtitle}
        />
        <InsightsContent classroomId={classroom.id} navigation={navigation} />
      </View>
    );
  };

  return (
    <View style={styles.pageShell}>
      <View pointerEvents="none" style={styles.readabilityOverlay} />
      <View style={styles.pageContent}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title}>{classroom.name}</Text>
              <Text style={styles.titleSub}>Living Classroom Garden</Text>
            </View>
            <View style={styles.headerActions}>
              {!isDesktopLayout && (
                <TouchableOpacity
                  style={styles.mobileSectionsButton}
                  onPress={() => setShowSectionSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open classroom sections"
                >
                  <Text style={styles.mobileSectionsButtonText}>Sections</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setShowSettings(true)}
                accessibilityRole="button"
                accessibilityLabel="Open classroom settings"
              >
                <MaterialCommunityIcons size={18} color={palette.primary} name="cog-outline" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerDeleteButton}
                onPress={handleDeleteClassroom}
                accessibilityRole="button"
                accessibilityLabel="Delete classroom"
              >
                <Text style={styles.headerDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
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

          <View style={styles.layoutRow}>
            {isDesktopLayout ? (
              <View style={styles.sidebarWrap}>
                <ClassroomSidebar
                  activeSection={activeSection}
                  onChange={setActiveSection}
                  mood={gardenMood}
                  badges={{
                    insights: assignmentsNeedingAttention,
                    assignments: assignments.length,
                    corpus: files.length,
                    students: students.length,
                  }}
                />
              </View>
            ) : null}
            <View style={styles.mainPane}>{renderActiveSection()}</View>
          </View>
        </View>
      </View>

      <Modal
        transparent
        visible={showSectionSheet && !isDesktopLayout}
        animationType="fade"
        onRequestClose={() => setShowSectionSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalScrim}
            onPress={() => setShowSectionSheet(false)}
            accessibilityRole="button"
            accessibilityLabel="Close sections"
          />
          <View style={styles.sectionSheet}>
            <Text style={styles.sectionSheetTitle}>Classroom Sections</Text>
            <ClassroomSidebar
              activeSection={activeSection}
              onChange={(section) => {
                setActiveSection(section);
                setShowSectionSheet(false);
              }}
              mood={gardenMood}
              badges={{
                insights: assignmentsNeedingAttention,
                assignments: assignments.length,
                corpus: files.length,
                students: students.length,
              }}
              compact
            />
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showSettings} animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalScrim}
            onPress={() => setShowSettings(false)}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          />
          <View style={styles.settingsPanel}>
            <View style={styles.settingsPanelHeader}>
              <Text style={styles.settingsTitle}>Classroom Settings</Text>
              <TouchableOpacity
                onPress={() => setShowSettings(false)}
                accessibilityRole="button"
                accessibilityLabel="Close classroom settings"
              >
                <MaterialCommunityIcons size={20} color={palette.textMuted} name="close" />
              </TouchableOpacity>
            </View>
            <Text style={styles.settingsSubtitle}>
              Control how students see hints, dots, analysis, and feedback in this class.
            </Text>
            <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
              <ConfigEditor config={config} onChange={setConfig} mode="classroom" />
              <View style={styles.settingsActions}>
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
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageShell: { flex: 1, position: "relative" },
  readabilityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.surface,
    opacity: 0.56,
  },
  pageContent: { flex: 1 },
  container: { flex: 1, padding: spacing.md, backgroundColor: "transparent" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: { ...typography.h1, color: palette.textPrimary, flex: 1 },
  headerTitleWrap: { flex: 1 },
  titleSub: {
    ...typography.caption,
    color: palette.forestCanopy,
    marginTop: spacing.xxs,
    fontWeight: "700",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  codeRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.xs },
  code: { ...typography.bodySmall, color: palette.textMuted },
  copyButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.button, backgroundColor: palette.tabInactive },
  copyButtonText: { fontSize: 13, fontWeight: "600", color: palette.primary },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: radius.button,
    backgroundColor: palette.tabInactive,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileSectionsButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: palette.border,
  },
  mobileSectionsButtonText: {
    ...typography.bodySmall,
    color: palette.textSecondary,
    fontWeight: "600",
  },
  layoutRow: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: spacing.md,
  },
  sidebarWrap: {
    width: 220,
  },
  mainPane: {
    flex: 1,
    minHeight: 0,
  },
  content: { flex: 1 },
  addButton: {
    backgroundColor: palette.forestCanopy,
    borderRadius: radius.organic,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  addButtonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  studentsHintCard: {
    backgroundColor: palette.forestMist,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    borderRadius: radius.organic,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  studentsHintTitle: {
    ...typography.bodySmall,
    color: palette.forestCanopy,
    fontWeight: "700",
    marginBottom: spacing.xxs,
  },
  studentsHintCopy: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  skeletonList: { marginTop: 8 },
  assignmentColumnWrap: {
    gap: spacing.sm,
  },
  cardColumnWrap: {
    gap: spacing.sm,
  },
  assignmentCell: {
    marginBottom: spacing.sm,
  },
  assignmentCellGrid: {
    width: "24%",
    flexGrow: 0,
  },
  cardCell: {
    marginBottom: spacing.sm,
  },
  cardCellGrid: {
    width: "32%",
    flexGrow: 0,
  },
  assignmentCard: {
    height: 140,
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    ...elevation.shadowSm,
  },
  assignmentCardAccent: {
    height: 6,
    backgroundColor: palette.forestCanopy,
  },
  assignmentCardBody: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  assignmentHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  assignmentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  assignmentOpenHint: {
    ...typography.caption,
    color: palette.forestCanopy,
    fontWeight: "700",
  },
  corpusCard: {
    height: 140,
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    justifyContent: "space-between",
    ...elevation.shadowSm,
  },
  corpusCardDisabled: {
    opacity: 0.66,
  },
  corpusCardTop: {
    gap: spacing.xs,
  },
  corpusCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  fileTypeChip: {
    alignSelf: "flex-start",
    backgroundColor: palette.forestMist,
    borderWidth: 1,
    borderColor: palette.primaryMuted,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fileTypeChipText: {
    ...typography.caption,
    color: palette.forestCanopy,
    fontWeight: "700",
  },
  studentCard: {
    height: 140,
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    ...elevation.shadowSm,
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.forestMist,
    alignItems: "center",
    justifyContent: "center",
  },
  studentCardBody: {
    flex: 1,
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  studentActionHint: {
    ...typography.caption,
    color: palette.forestCanopy,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  itemTitle: { fontSize: 16, fontWeight: "600", color: palette.textPrimary },
  itemSub: { ...typography.caption, color: palette.textMuted },
  dueOverdue: { color: palette.error },
  dueSoon: { color: palette.warning },
  badgeOverdue: { fontSize: 11, fontWeight: "600", color: palette.error },
  badgeSoon: { fontSize: 11, fontWeight: "600", color: palette.warning },
  downloadHint: { fontSize: 13, color: palette.primary, fontWeight: "600", marginLeft: 8 },
  downloadHintDisabled: { color: palette.textDisabled },
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
  settingsContent: {
    paddingBottom: spacing.xl,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsPanel: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "88%",
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...elevation.shadowSm,
  },
  settingsPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  settingsTitle: {
    ...typography.h2,
    color: palette.textPrimary,
  },
  settingsSubtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  settingsActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  saveButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.organic,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...elevation.shadowSm,
  },
  saveButtonText: { ...typography.button, color: palette.textOnPrimary },
  deleteButton: {
    backgroundColor: palette.errorBg,
    borderRadius: radius.organic,
    borderWidth: 1,
    borderColor: palette.error,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  deleteButtonText: { ...typography.button, color: palette.error },
  headerDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: palette.errorBg,
    marginLeft: "auto",
  },
  headerDeleteButtonText: { fontSize: 13, fontWeight: "600", color: palette.error },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sectionSheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: spacing.md,
    ...elevation.shadowSm,
  },
  sectionSheetTitle: {
    ...typography.body,
    fontWeight: "700",
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
});
