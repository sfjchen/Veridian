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
import { TreeIcon, LeafAccent } from "@/components/forest";
import { palette, radius, elevation } from "@/constants/palette";
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
  index,
  onPress,
}: {
  assignment: AssignmentListItem;
  index: number;
  onPress: () => void;
}) {
  const dueStr = formatDueDate(assignment.due_date);
  const even = index % 2 === 0;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        elevation.shadowMd,
        pressed && { opacity: 0.9 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open assignment ${assignment.title}`}
    >
      <View style={styles.cardGradient}>
        <View style={[styles.cardGradientHalf, { backgroundColor: even ? palette.forestCanopy : palette.forestLeaf }]} />
        <View style={[styles.cardGradientHalf, { backgroundColor: even ? palette.forestLeaf : palette.forestCanopy }]} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardLeafCorner}>
          <LeafAccent size={12} color={even ? palette.forestLeaf : palette.forestCanopy} />
        </View>
        <MaterialCommunityIcons name="file-document-outline" size={28} color={even ? palette.forestCanopy : palette.forestLeaf} />
        <View style={styles.cardTextCol}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {assignment.title}
          </Text>
          {dueStr ? (
            <Text style={styles.cardDue} numberOfLines={1}>
              Due {dueStr}
            </Text>
          ) : null}
        </View>
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
          renderItem={({ item, index }) => (
            <AssignmentCard
              assignment={item}
              index={index}
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
    gap: spacing.sm,
  },
  card: {
    height: 100,
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    overflow: "hidden",
  },
  cardGradient: {
    flexDirection: "row",
    height: 4,
    borderTopLeftRadius: radius.organic,
    borderTopRightRadius: radius.organic,
    overflow: "hidden",
  },
  cardGradientHalf: { flex: 1 },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
    position: "relative",
  },
  cardLeafCorner: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    opacity: 0.5,
  },
  cardTextCol: {
    flex: 1,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  cardDue: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },
  skeletonList: { padding: spacing.md },
});
