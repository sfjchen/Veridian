import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';
import { useAssignments } from '@/hooks/useAssignments';
import type { AssignmentListItem } from '@/lib/api';

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '';
  try {
    const d = new Date(dueDate);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
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
      accessibilityRole="button">
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
      accessibilityLabel="Back to classes">
      <MaterialCommunityIcons name="arrow-left" size={24} color={palette.primary} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );

  if (!classroomId) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          {backAction}
          <Text style={styles.title} numberOfLines={1}>Assignments</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing classroom</Text>
        </View>
      </SafeAreaView>
    );
  }

  const title = classroomName ?? 'Assignments';

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          {backAction}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Loading assignments…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          {backAction}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={palette.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}
            onPress={refresh}
            accessibilityRole="button"
            accessibilityLabel="Retry loading assignments">
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        {backAction}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {assignments.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={palette.borderStrong} />
          <Text style={styles.emptyTitle}>No assignments yet</Text>
          <Text style={styles.emptySubtitle}>Assignments from your teacher will appear here.</Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          {assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              onPress={() =>
                router.push({
                  pathname: '/document/[id]',
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
    padding: spacing.xs,
    minHeight: 44,
    minWidth: 80,
  },
  backText: {
    ...typography.button,
    color: palette.primary,
    marginLeft: spacing.xxs,
  },
  title: {
    flex: 1,
    ...typography.body,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  headerSpacer: { width: 88 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    padding: spacing.sm,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderTopWidth: 3,
    borderTopColor: palette.primary,
  },
  rowIcon: { marginRight: spacing.sm },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: {
    ...typography.body,
    fontWeight: '500',
    color: palette.textSecondary,
  },
  rowDue: {
    ...typography.caption,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: spacing.xxs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: { ...typography.body, color: palette.textMuted },
  errorText: { ...typography.body, color: palette.error, textAlign: 'center' },
  retryButton: {
    marginTop: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonText: {
    ...typography.buttonSmall,
    color: palette.textOnPrimary,
  },
  emptyTitle: { ...typography.h2, color: palette.textSecondary },
  emptySubtitle: { ...typography.bodySmall, color: palette.textMuted, marginTop: spacing.xs, textAlign: 'center' },
});
