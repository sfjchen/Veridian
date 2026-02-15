import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ScreenContainer,
  SkeletonCard,
} from "@/components/ui";
import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useAccessToken } from "@/hooks/useAccessToken";
import { useClassrooms } from "@/hooks/useClassrooms";
import type { Classroom } from "@/lib/api";
import { joinClassroom } from "@/lib/api";
import { supabase } from "@/lib/supabase";

function SignOutButton() {
  const handleSignOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7 }]}
      onPress={handleSignOut}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
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
    <Card onPress={onPress} style={styles.card}>
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
    </Card>
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
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!token) {
      setError("You must be signed in to join a class.");
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const classroom = await joinClassroom(code.trim(), token);
      setCode("");
      onClose();
      onJoined(classroom);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join classroom");
    } finally {
      setJoining(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        style={styles.modalOverlay}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close modal">
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.modalTitle}>Join a class</Text>
          <Text style={styles.modalSubtitle}>Enter the class code from your teacher.</Text>
          <Input
            placeholder="Class code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!joining}
            error={error ?? undefined}
            containerStyle={styles.modalInputWrap}
            accessibilityLabel="Class code"
          />
          <View style={styles.modalActions}>
            <Button variant="ghost" onPress={handleClose} disabled={joining}>
              Cancel
            </Button>
            <Button
              onPress={handleJoin}
              loading={joining}
              disabled={!code.trim()}
              accessibilityLabel="Join class"
            >
              Join
            </Button>
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
      <ScreenContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Classes</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/WorkspaceScreen")}
              accessibilityRole="button"
              accessibilityLabel="Whiteboard"
            >
              <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
              <Text style={styles.workspaceButtonText}>Workspace</Text>
            </Pressable>
            <SignOutButton />
          </View>
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
          <Text style={styles.title}>Classes</Text>
          <View style={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setJoinModalVisible(true)}
              style={styles.joinButton}
            >
              Join Class
            </Button>
            <Pressable
              style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/WorkspaceScreen")}
              accessibilityRole="button"
              accessibilityLabel="Whiteboard"
            >
              <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
              <Text style={styles.workspaceButtonText}>Workspace</Text>
            </Pressable>
            <SignOutButton />
          </View>
        </View>
        <ErrorState
          message={error}
          onRetry={refresh}
        />
        <JoinClassModal
          visible={joinModalVisible}
          onClose={() => setJoinModalVisible(false)}
          onJoined={handleJoined}
          token={accessToken}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        <View style={styles.headerActions}>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setJoinModalVisible(true)}
            style={styles.joinButton}
          >
            Join Class
          </Button>
          <Pressable
            style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/WorkspaceScreen")}
            accessibilityRole="button"
            accessibilityLabel="Whiteboard"
          >
            <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
            <Text style={styles.workspaceButtonText}>Workspace</Text>
          </Pressable>
          <SignOutButton />
        </View>
      </View>

      {welcomeName && (
        <Pressable
          style={styles.welcomeBanner}
          onPress={dismissWelcome}
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message">
          <MaterialCommunityIcons name="party-popper" size={20} color={palette.primary} />
          <Text style={styles.welcomeText}>Welcome to {welcomeName}!</Text>
          <MaterialCommunityIcons name="close" size={18} color={palette.textMuted} />
        </Pressable>
      )}

      {classrooms.length === 0 ? (
        <EmptyState
          title="You do not have any classes"
          description="Join a class with a code from your teacher."
          actionLabel="Join a Class"
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
                  pathname: "/assignments/[classroomId]",
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.card,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  joinButton: { marginRight: spacing.xs },
  workspaceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.card,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardIcon: { marginRight: spacing.sm },
  cardTitle: {
    flex: 1,
    ...typography.body,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  cardCode: {
    ...typography.caption,
    color: palette.textMuted,
    marginRight: 8,
  },
  skeletonList: { padding: spacing.md },
  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  welcomeText: {
    flex: 1,
    ...typography.bodySmall,
    fontWeight: "600",
    color: palette.primary,
  },
  signOutButton: {
    padding: 10,
    borderRadius: radius.button,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
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
  modalInputWrap: { marginBottom: spacing.sm },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
});
