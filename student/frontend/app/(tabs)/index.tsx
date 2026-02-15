import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { palette, radius } from '@/constants/palette';
import { spacing, typography } from '@/constants/theme';
import { useAccessToken } from '@/hooks/useAccessToken';
import { useClassrooms } from '@/hooks/useClassrooms';
import type { Classroom } from '@/lib/api';
import { joinClassroom } from '@/lib/api';
import { supabase } from '@/lib/supabase';

function SignOutButton() {
  const handleSignOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7 }]}
      onPress={handleSignOut}
      accessibilityRole="button"
      accessibilityLabel="Sign out">
      <MaterialCommunityIcons name="logout" size={20} color={palette.textMuted} />
    </Pressable>
  );
}

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

function JoinClassModal({
  visible,
  onClose,
  onJoined,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: (classroom: Classroom) => void;
  token: string | undefined;
}) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!token) {
      setError('You must be signed in to join a class.');
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const classroom = await joinClassroom(code.trim(), token);
      setCode('');
      onClose();
      onJoined(classroom);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join classroom');
    } finally {
      setJoining(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.modalTitle}>Join a class</Text>
          <Text style={styles.modalSubtitle}>Enter the class code from your teacher.</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Class code"
            placeholderTextColor={palette.textMuted}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!joining}
          />
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalCancel, pressed && { opacity: 0.7 }]}
              onPress={handleClose}
              disabled={joining}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalJoin,
                (!code.trim() || joining) && styles.buttonDisabled,
                pressed && code.trim() && !joining && { opacity: 0.8 },
              ]}
              onPress={handleJoin}
              disabled={!code.trim() || joining}>
              {joining ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text style={styles.modalJoinText}>Join</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ClassroomsScreen() {
  const router = useRouter();
  const { classrooms, loading, error, refresh } = useClassrooms();
  const accessToken = useAccessToken() ?? undefined;
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const handleJoined = (classroom: Classroom) => {
    setWelcomeName(classroom.name);
    refresh();
  };

  const dismissWelcome = () => setWelcomeName(null);

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
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/WorkspaceScreen')}
              accessibilityRole="button"
              accessibilityLabel="Whiteboard">
              <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
              <Text style={styles.workspaceButtonText}>Workspace</Text>
            </Pressable>
            <SignOutButton />
          </View>
        </View>
        <View style={styles.centered}>
          <ErrorState
            message="Something went wrong loading your classes. Check your connection and try again."
            onRetry={refresh}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.joinButton, pressed && { opacity: 0.7 }]}
            onPress={() => setJoinModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Join a class">
            <MaterialCommunityIcons name="plus" size={20} color={palette.primary} />
            <Text style={styles.joinButtonText}>Join Class</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/WorkspaceScreen')}
            accessibilityRole="button"
            accessibilityLabel="Whiteboard">
            <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
            <Text style={styles.workspaceButtonText}>Workspace</Text>
          </Pressable>
          <SignOutButton />
        </View>
      </View>

      {welcomeName && (
        <Pressable style={styles.welcomeBanner} onPress={dismissWelcome}>
          <MaterialCommunityIcons name="party-popper" size={20} color={palette.primary} />
          <Text style={styles.welcomeText}>Welcome to {welcomeName}!</Text>
          <MaterialCommunityIcons name="close" size={18} color={palette.textMuted} />
        </Pressable>
      )}

      {classrooms.length === 0 ? (
        <EmptyState
          title="You do not have any classes"
          description="Join a class with a code from your teacher."
          icon={<MaterialCommunityIcons name="school-outline" size={64} color={palette.borderStrong} />}
          actionLabel="Join a class"
          onAction={() => setJoinModalVisible(true)}
        />
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

      <JoinClassModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
        onJoined={handleJoined}
        token={accessToken}
      />
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.card,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: palette.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    minHeight: 44,
    justifyContent: 'center',
  },
  joinButtonText: {
    ...typography.buttonSmall,
    color: palette.primary,
  },
  workspaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    minHeight: 44,
    justifyContent: 'center',
  },
  workspaceButtonText: {
    ...typography.buttonSmall,
    color: palette.primary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
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
  cardIcon: {
    marginRight: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    ...typography.body,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  cardCode: {
    ...typography.caption,
    fontSize: 13,
    color: palette.textMuted,
    marginRight: spacing.xs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: palette.textMuted,
  },
  errorText: {
    ...typography.body,
    color: palette.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: palette.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonText: {
    ...typography.buttonSmall,
    color: palette.textOnPrimary,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    color: palette.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  joinCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    backgroundColor: palette.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    minHeight: 44,
    justifyContent: 'center',
  },
  joinCtaText: {
    ...typography.button,
    color: palette.textOnPrimary,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  welcomeText: {
    flex: 1,
    ...typography.body,
    fontWeight: '600',
    color: palette.primary,
  },
  signOutButton: {
    padding: spacing.sm,
    borderRadius: radius.button,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: palette.card,
    borderRadius: radius.modal,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: palette.textPrimary,
    marginBottom: spacing.xxs,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  modalInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    ...typography.body,
    fontWeight: '600',
    color: palette.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalError: {
    ...typography.bodySmall,
    color: palette.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  modalCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalCancelText: {
    ...typography.body,
    fontWeight: '500',
    color: palette.textMuted,
  },
  modalJoin: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalJoinText: {
    ...typography.button,
    color: palette.textOnPrimary,
  },
});
