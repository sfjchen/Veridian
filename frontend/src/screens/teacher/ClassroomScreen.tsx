import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useCorpus } from "../../hooks/useCorpus";
import { useAssignments } from "../../hooks/useAssignments";
import { Classroom } from "../../types";

type Tab = "assignments" | "corpus" | "students";

export function TeacherClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom: Classroom = route.params.classroom;
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const { files, loading: corpusLoading } = useCorpus(classroom.id);
  const { assignments, loading: assignmentsLoading } = useAssignments(classroom.id);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{classroom.name}</Text>
      <Text style={styles.code}>Class Code: {classroom.class_code}</Text>

      <View style={styles.tabs}>
        {(["assignments", "corpus", "students"] as Tab[]).map((tab) => (
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
            onPress={() => navigation.navigate("CreateAssignment", { classroomId: classroom.id })}
          >
            <Text style={styles.addButtonText}>+ New Assignment</Text>
          </TouchableOpacity>
          {assignmentsLoading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSub}>
                    {item.due_date ? `Due: ${new Date(item.due_date).toLocaleDateString()}` : "No due date"}
                  </Text>
                </View>
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
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <Text style={styles.itemTitle}>{item.display_name}</Text>
                  <Text style={styles.itemSub}>{item.file_type}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No corpus files yet</Text>}
            />
          )}
        </View>
      )}

      {activeTab === "students" && (
        <View style={styles.content}>
          <Text style={styles.empty}>Student list coming soon</Text>
        </View>
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
    marginBottom: 8,
  },
  itemTitle: { fontSize: 16, fontWeight: "500" },
  itemSub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 20 },
});
