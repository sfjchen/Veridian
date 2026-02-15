import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAssignments } from "../../hooks/useAssignments";
import { ScreenContainer } from "../../components/ui";
import { Classroom } from "../../types";
import { palette, radius, elevation } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export function StudentClassroomScreen({ route, navigation }: { route: any; navigation: any }) {
  const classroom: Classroom = route.params.classroom;
  const { assignments, loading, error } = useAssignments(classroom.id);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{classroom.name}</Text>
      {loading ? (
        <ActivityIndicator size="large" color={palette.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("Assignment", { assignmentId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}`}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>
                {item.due_date
                  ? `Due: ${new Date(item.due_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}`
                  : "No due date"}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No assignments yet</Text>
              <Text style={styles.emptySubtitle}>Your teacher will add assignments here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: palette.surface },
  title: { ...typography.h1, marginBottom: 16, color: palette.textPrimary },
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
  cardSub: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 24, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: palette.textSecondary, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: palette.textMuted, textAlign: "center" },
  errorText: { textAlign: "center", color: palette.error, marginTop: 40 },
});
