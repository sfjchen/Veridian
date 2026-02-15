import React from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useAssignments } from "../../hooks/useAssignments";
import { Button, Card, ScreenContainer } from "../../components/ui";
import { Assignment } from "../../types";
import { palette } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export function StudentSubmissionsScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classroomId, studentId, studentDisplayName } = route.params;
  const { assignments, loading, error } = useAssignments(classroomId);

  return (
    <ScreenContainer maxWidth="dashboard">
      <View style={styles.header}>
        <Text style={styles.title}>{studentDisplayName}</Text>
        <Text style={styles.subtitle}>Assignments</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : assignments.length === 0 ? (
        <Text style={styles.emptyText}>No assignments in this classroom</Text>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item: Assignment) => item.id}
          renderItem={({ item }: { item: Assignment }) => (
            <Card style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.due_date && (
                  <Text style={styles.itemSub}>
                    Due {new Date(item.due_date).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
                    })}
                  </Text>
                )}
              </View>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => navigation.navigate("StudentWorkReview", {
                  assignmentId: item.id,
                  studentId,
                  studentDisplayName,
                })}
              >
                Review
              </Button>
            </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.lg },
  title: { ...typography.h1, color: palette.textPrimary },
  subtitle: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xxs },
  loader: { marginTop: 40 },
  errorText: { textAlign: "center", color: palette.error, marginTop: 20 },
  emptyText: { textAlign: "center", color: palette.textMuted, marginTop: 40 },
  card: {
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: "500", color: palette.textPrimary },
  itemSub: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
});
