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

import { palette, radius } from '@/constants/palette';
import { useClassrooms } from '@/hooks/useClassrooms';
import type { Classroom } from '@/lib/api';
import { joinClassroom } from '@/lib/api';
import { supabase } from '@/lib/supabase';

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
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setError(null);
    setJoining(true);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      await joinClassroom(code.trim(), token ?? undefined);
      setCode('');
      onClose();
      onJoined();
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
  const [joinModalVisible, setJoinModalVisible] = useState(false);

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
    const isMissingToken = /missing bearer token/i.test(error);
    const canSignIn = !!supabase;
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
            {isMissingToken && canSignIn
              ? 'Sign in with your student account to see your classes.'
              : isMissingToken && !canSignIn
                ? 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in student/frontend/.env, then sign in. Or set EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN to a valid user JWT.'
                : 'Sign in or check your connection to see your classes.'}
          </Text>
          {isMissingToken && canSignIn ? (
            <Pressable
              style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.8 }]}
              onPress={() => router.push('/sign-in')}
              accessibilityRole="button">
              <Text style={styles.signInButtonText}>Sign in</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel="Retry loading classes">
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          )}
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
        </View>
      </View>

      {classrooms.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="school-outline" size={64} color={palette.borderStrong} />
          <Text style={styles.emptyTitle}>No classes yet</Text>
          <Text style={styles.emptySubtitle}>Join a class with a code from your teacher.</Text>
          <Pressable
            style={({ pressed }) => [styles.joinCtaButton, pressed && { opacity: 0.8 }]}
            onPress={() => setJoinModalVisible(true)}
            accessibilityRole="button">
            <MaterialCommunityIcons name="plus" size={20} color={palette.white} />
            <Text style={styles.joinCtaText}>Join a Class</Text>
          </Pressable>
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

      <JoinClassModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
        onJoined={refresh}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.card,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  joinButtonText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '600',
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
  retryButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    backgroundColor: palette.primary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.white,
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
  joinCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    backgroundColor: palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.button,
  },
  joinCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.white,
  },
  signInButton: {
    marginTop: 16,
    backgroundColor: palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.button,
  },
  signInButtonText: { fontSize: 16, fontWeight: '600', color: palette.white },
  buttonDisabled: { opacity: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: palette.textMuted,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalError: {
    fontSize: 14,
    color: palette.errorText,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.textMuted,
  },
  modalJoin: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: palette.primary,
    borderRadius: radius.button,
  },
  modalJoinText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.white,
  },
});
