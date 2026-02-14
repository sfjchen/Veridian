import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { palette, radius } from '@/constants/palette';
import { useClassrooms } from '@/hooks/useClassrooms';
import type { Classroom } from '@/lib/api';

function ClassroomCard({
  classroom,
  onPress,
}: {
  classroom: Classroom;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { backgroundColor: palette.rowPressed, opacity: 0.9 },
      ]}
      onPress={onPress}
      accessibilityRole="button">
      <View style={styles.cardIcon}>
        <MaterialCommunityIcons name="school-outline" size={32} color={palette.primary} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {classroom.name}
      </Text>
      {classroom.class_code ? (
        <Text style={styles.cardCode} numberOfLines={1}>
          {classroom.class_code}
        </Text>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={24} color={palette.textDisabled} />
    </Pressable>
  );
}

export default function ClassroomsScreen() {
  const router = useRouter();
  const { classrooms, loading, error } = useClassrooms();

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Loading classrooms…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Classes</Text>
          <Pressable
            style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/WorkspaceScreen')}
            accessibilityRole="button"
            accessibilityLabel="Whiteboard">
            <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
            <Text style={styles.workspaceButtonText}>Workspace</Text>
          </Pressable>
        </View>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={palette.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.emptySubtitle}>
            Sign in or check your connection to see your classes.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <Pressable
          style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/WorkspaceScreen')}
          accessibilityRole="button"
          accessibilityLabel="Whiteboard">
          <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
          <Text style={styles.workspaceButtonText}>Workspace</Text>
        </Pressable>
      </View>

      {classrooms.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="school-outline" size={64} color={palette.borderStrong} />
          <Text style={styles.emptyTitle}>No classes yet</Text>
          <Text style={styles.emptySubtitle}>Sign in to see your classes or join a class with a code.</Text>
        </View>
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClassroomCard
              classroom={item}
              onPress={() =>
                router.push({
                  pathname: '/assignments/[classroomId]',
                  params: { classroomId: item.id, classroomName: item.name },
                })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.card,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  workspaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  workspaceButtonText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    padding: 14,
    borderRadius: radius.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  cardCode: {
    fontSize: 13,
    color: palette.textMuted,
    marginRight: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: palette.textMuted,
  },
  errorText: {
    fontSize: 15,
    color: palette.errorText,
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textSecondary,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
});
