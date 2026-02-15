import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useClassrooms } from "../../hooks/useClassrooms";
import { useAuth } from "../../stores/auth";
import { ClassCodeInput } from "../../components/ClassCodeInput";
import { Classroom } from "../../types";
import { palette, radius, typography } from "../../constants/palette";

export function StudentDashboardScreen({ navigation }: { navigation: any }) {
  const { classrooms, loading, error, join } = useClassrooms();
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classes</Text>
        <TouchableOpacity
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ClassCodeInput onSubmit={join} />

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} color={palette.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item: Classroom) => item.id}
          renderItem={({ item }: { item: Classroom }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("StudentClassroom", { classroom: item })}
              accessibilityRole="button"
              accessibilityLabel={`Open class ${item.name}`}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No classes yet</Text>
              <Text style={styles.emptySubtitle}>Enter a class code above to join.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: palette.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { ...typography.h1, color: palette.textPrimary },
  logoutText: { color: palette.error, fontSize: 14, fontWeight: "600" },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: palette.textPrimary },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: palette.textSecondary, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: palette.textMuted, textAlign: "center" },
  errorText: { textAlign: "center", color: palette.error, marginTop: 40, fontSize: 16 },
});
