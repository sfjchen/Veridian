import React from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useClassrooms } from "../../hooks/useClassrooms";
import { useAuth } from "../../stores/auth";
import { ClassCodeInput } from "../../components/ClassCodeInput";

export function StudentDashboardScreen({ navigation }: { navigation: any }) {
  const { classrooms, loading, join } = useClassrooms();
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classes</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ClassCodeInput onSubmit={join} />

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item: any) => item.classroom_id ?? item.id}
          renderItem={({ item }: { item: any }) => {
            const classroom = item.classrooms ?? item;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate("StudentClassroom", { classroom })}
              >
                <Text style={styles.cardTitle}>{classroom.name}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No classes yet. Join one above!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "bold" },
  logoutText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 40, fontSize: 16 },
});
