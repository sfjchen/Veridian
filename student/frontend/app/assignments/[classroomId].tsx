import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  EmptyState,
  ErrorState,
  ScreenContainer,
  SkeletonCard,
} from "@/components/ui";
import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useAssignments } from "@/hooks/useAssignments";
import type { AssignmentListItem } from "@/lib/api";

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "";
  try {
    const d = new Date(dueDate);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  } catch {
    return "";
  }
}

function AssignmentRow({
  assignment,
  onPress,
}: {
  assignment: AssignmentListItem;
  onPress: () => void;
}) {
  const dueStr = formatDueDate(assignment.due_date);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: palette.rowPressed, opacity: 0.9 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open assignment ${assignment.title}`}
    >
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="file-document-outline" size={28} color={palette.textMuted} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {assignment.title}
        </Text>
        {dueStr ? (
          <Text style={styles.rowDue} numberOfLines={1}>
            Due {dueStr}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={palette.textDisabled} />
    </Pressable>
  );
}

export default function AssignmentsScreen() {
  const { classroomId, classroomName } = useLocalSearchParams<{
    classroomId: string;
    classroomName?: string;
  }>();
  const router = useRouter();
  const { assignments, loading, error, refresh } = useAssignments(classroomId ?? null);

  const backAction = (
    <Pressable
      style={({ pressed }) => [styles.backWrap, pressed && { opacity: 0.7 }]}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back to classes"
    >
      <MaterialCommunityIcons name="arrow-left" size={24} color={palette.primary} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );

  if (!classroomId) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          {backAction}
          <Text style={styles.title} numberOfLines={1}>
            Assignments
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <ErrorState message="Missing classroom" />
      </ScreenContainer>
    );
  }

  const title = classroomName ?? "Assignments";

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          {backAction}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.skeletonList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          {backAction}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        {backAction}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Assignments from your teacher will appear here."
        />
      ) : (
        <View style={styles.listContent}>
          {assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: {
                    id: a.id,
                    assignmentId: a.id,
                    classroomName: classroomName ?? undefined,
                  },
                })
              }
            />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.sm,
    padding: spacing.xs,
    minHeight: 44,
    minWidth: 80,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.primary,
    marginLeft: 4,
  },
  title: {
    flex: 1,
    ...typography.body,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  headerSpacer: { width: 88 },
  listContent: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.card,
    padding: 14,
    borderRadius: radius.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rowIcon: { marginRight: 12 },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: {
    ...typography.body,
    fontWeight: "500",
    color: palette.textSecondary,
  },
  rowDue: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  skeletonList: { padding: spacing.md },
});
