import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  FlatList,
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
import { TreeIcon } from "@/components/forest";
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

function AssignmentCard({
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
        styles.card,
        pressed && { backgroundColor: palette.rowPressed, opacity: 0.9 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open assignment ${assignment.title}`}
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardBody}>
        <MaterialCommunityIcons name="file-document-outline" size={28} color={palette.primary} />
        <Text style={styles.cardTitle} numberOfLines={2}>
          {assignment.title}
        </Text>
        {dueStr ? (
          <Text style={styles.cardDue} numberOfLines={1}>
            Due {dueStr}
          </Text>
        ) : null}
      </View>
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
          icon={<TreeIcon size={48} color={palette.primary} />}
          title="No assignments yet"
          description="Assignments from your teacher will appear here."
        />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <AssignmentCard
              assignment={item}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: {
                    id: item.id,
                    assignmentId: item.id,
                    classroomName: classroomName ?? undefined,
                  },
                })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
        />
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
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  gridRow: {
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minHeight: 120,
    backgroundColor: palette.card,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  cardAccent: {
    height: 4,
    backgroundColor: palette.forestCanopy,
  },
  cardBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "500",
    color: palette.textPrimary,
    textAlign: "center",
  },
  cardDue: {
    ...typography.caption,
    color: palette.textMuted,
  },
  skeletonList: { padding: spacing.md },
});
