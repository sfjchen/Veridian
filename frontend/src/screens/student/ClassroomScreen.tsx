import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useAssignments } from "../../hooks/useAssignments";
import { Classroom } from "../../types";

export function StudentClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom: Classroom = route.params.classroom;
  const { assignments, loading } = useAssignments(classroom.id);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{classroom.name}</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("Assignment", { assignmentId: item.id })}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>
                {item.due_date ? `Due: ${new Date(item.due_date).toLocaleDateString()}` : "No due date"}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No assignments yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  cardSub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
});
