import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { useCorpus } from "../../hooks/useCorpus";
import { useAssignments } from "../../hooks/useAssignments";
import { useClassroomStudents } from "../../hooks/useClassroomStudents";
import { ConfigEditor } from "../../components/ConfigEditor";
import { api } from "../../lib/api";
import { alert } from "../../lib/alert";
import { AssignmentConfig, Classroom, CorpusFile } from "../../types";
import { InsightsContent } from "./InsightsContent";

type Tab = "assignments" | "corpus" | "students" | "insights" | "settings";

export function TeacherClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom: Classroom = route.params.classroom;
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
      alert("Success", "Settings saved");
    } catch (e: any) {
      alert("Error", e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenCorpusFile = (file: CorpusFile) => {
    if (file.download_url) {
      Linking.openURL(file.download_url);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{classroom.name}</Text>
      <Text style={styles.code}>Class Code: {classroom.class_code}</Text>

      <View style={styles.tabs}>
        {(["assignments", "corpus", "students", "insights", "settings"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
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
          >
            <Text style={styles.addButtonText}>+ New Assignment</Text>
          </TouchableOpacity>
          {assignmentsLoading ? (
            <ActivityIndicator />
          ) : assignmentsError ? (
            <Text style={styles.errorText}>{assignmentsError}</Text>
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => navigation.navigate("TeacherAssignment", { assignmentId: item.id })}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSub}>
                      {item.due_date
                        ? `Due: ${new Date(item.due_date).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                          })}`
                        : "No due date"}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>&gt;</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No assignments yet</Text>}
            />
          )}
        </View>
      )}

      {activeTab === "corpus" && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("CorpusUpload", { classroomId: classroom.id })}
          >
            <Text style={styles.addButtonText}>+ Upload File</Text>
          </TouchableOpacity>
          {corpusLoading ? (
            <ActivityIndicator />
          ) : corpusError ? (
            <Text style={styles.errorText}>{corpusError}</Text>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleOpenCorpusFile(item)}
                  disabled={!item.download_url}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle}>{item.display_name}</Text>
                    <Text style={styles.itemSub}>{item.file_type}</Text>
                  </View>
                  {item.download_url && <Text style={styles.downloadHint}>Open</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No corpus files yet</Text>}
            />
          )}
        </View>
      )}

      {activeTab === "students" && (
        <View style={styles.content}>
          {studentsLoading ? (
            <ActivityIndicator />
          ) : studentsError ? (
            <Text style={styles.errorText}>{studentsError}</Text>
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) => item.student_id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <View style={styles.listItemContent}>
                    <Text style={styles.itemTitle}>{item.display_name ?? "Unnamed Student"}</Text>
                    <Text style={styles.itemSub}>
                      Joined {new Date(item.joined_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                      })}
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No students have joined yet</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  title: { fontSize: 24, fontWeight: "bold" },
  code: { fontSize: 14, color: "#6B7280", marginBottom: 16 },
  tabs: { flexDirection: "row", marginBottom: 16, gap: 8 },
  tab: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: "#E5E7EB", alignItems: "center" },
  tabActive: { backgroundColor: "#4F46E5" },
  tabText: { fontWeight: "600", color: "#374151" },
  tabTextActive: { color: "#fff" },
  content: { flex: 1 },
  addButton: {
    backgroundColor: "#10B981", borderRadius: 8, padding: 12,
    alignItems: "center", marginBottom: 12,
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  listItem: {
    backgroundColor: "#fff", borderRadius: 8, padding: 14,
    marginBottom: 8, flexDirection: "row", alignItems: "center",
  },
  listItemContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: "500" },
  itemSub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  chevron: { fontSize: 18, color: "#9CA3AF", marginLeft: 8 },
  downloadHint: { fontSize: 13, color: "#4F46E5", fontWeight: "600", marginLeft: 8 },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 20 },
  errorText: { textAlign: "center", color: "#EF4444", marginTop: 20 },
  settingsHint: { fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 18 },
});
