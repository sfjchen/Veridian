import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useClassrooms } from "../../hooks/useClassrooms";
import { useAuth } from "../../stores/auth";

export function TeacherDashboardScreen({ navigation }: { navigation: any }) {
  const { classrooms, loading, error, create } = useClassrooms();
  const { signOut } = useAuth();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert("Error", "Classroom name cannot be empty");
      return;
    }
    setCreating(true);
    try {
      await create(trimmed);
      setNewName("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classrooms</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="New classroom name"
          value={newName}
          onChangeText={setNewName}
        />
        <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={creating}>
          <Text style={styles.createButtonText}>{creating ? "..." : "Create"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("Classroom", { classroom: item })}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardCode}>Code: {item.class_code}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No classrooms yet. Create one above!</Text>}
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
  createRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: "#fff",
  },
  createButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, paddingHorizontal: 20,
    justifyContent: "center",
  },
  createButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  cardCode: { fontSize: 14, color: "#6B7280" },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 40, fontSize: 16 },
  errorText: { textAlign: "center", color: "#EF4444", marginTop: 40, fontSize: 16 },
});
