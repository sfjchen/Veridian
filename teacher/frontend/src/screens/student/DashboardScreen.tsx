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
import { ScreenContainer } from "../../components/ui";
import { Classroom } from "../../types";
import { palette, radius, elevation } from "../../constants/palette";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export function StudentDashboardScreen({ navigation }: { navigation: any }) {
  const { classrooms, loading, error, join } = useClassrooms();
  const { signOut } = useAuth();

  return (
    <ScreenContainer maxWidth="dashboard">
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
              style={[styles.card, elevation.shadowSm]}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: spacing.md },
  title: { ...typography.h1 },
  logoutText: { ...typography.bodySmall, color: palette.error, fontWeight: "600" as const },
  loader: { marginTop: spacing.xxl },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.h2 },
  emptyWrap: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, alignItems: "center" as const },
  emptyTitle: { ...typography.h2, color: palette.textSecondary, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, color: palette.textMuted, textAlign: "center" as const },
  empty: { ...typography.body, textAlign: "center" as const, color: palette.textDisabled, marginTop: spacing.xxl },
  errorText: { ...typography.body, textAlign: "center" as const, color: palette.error, marginTop: spacing.xxl },
});
