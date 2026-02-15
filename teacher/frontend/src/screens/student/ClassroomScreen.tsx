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
    <ScreenContainer maxWidth="dashboard">
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
              style={[styles.card, elevation.shadowSm]}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, marginBottom: spacing.md },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.h2 },
  cardSub: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xxs },
  empty: { ...typography.body, textAlign: "center" as const, color: palette.textDisabled, marginTop: spacing.xxl },
  errorText: { ...typography.body, textAlign: "center" as const, color: palette.error, marginTop: spacing.xxl },
});
