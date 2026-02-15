import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Button,
  ErrorState,
  Input,
  ScreenContainer,
  SkeletonCard,
} from "@/components/ui";
import { TreeIcon, LeafAccent } from "@/components/forest";
import { palette, radius, elevation } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { motion } from "@/constants/motion";
import { useAccessToken } from "@/hooks/useAccessToken";
import { useClassrooms } from "@/hooks/useClassrooms";
import type { Classroom } from "@/lib/api";
import { joinClassroom } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const STAGGER_DELAY_MS = 60;

/* ── Staggered card entrance ── */

function StaggeredCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const delay = index * STAGGER_DELAY_MS;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.normal,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.normal,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={[staggerStyles.wrapper, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const staggerStyles = StyleSheet.create({
  wrapper: { width: "100%" },
});

/* ── Gradient-style top border ── */

function CardGradientBorder({ even }: { even: boolean }) {
  return (
    <View style={borderStyles.wrapper}>
      <View style={[borderStyles.half, { backgroundColor: even ? palette.forestCanopy : palette.forestLeaf }]} />
      <View style={[borderStyles.half, { backgroundColor: even ? palette.forestLeaf : palette.forestCanopy }]} />
    </View>
  );
}

const borderStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    height: 4,
    borderTopLeftRadius: radius.organic,
    borderTopRightRadius: radius.organic,
    overflow: "hidden",
  },
  half: { flex: 1 },
});

/* ── Sign out ── */

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

/* ── Forest-themed header ── */

function DashboardHeader({ onJoin }: { onJoin: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBg}>
        <View style={styles.headerMistLayer} />
      </View>
      <View style={styles.headerContent}>
        <View style={styles.headerTitleRow}>
          <View style={styles.heroIconCluster}>
            <TreeIcon size={24} color={palette.forestCanopy} />
            <View style={styles.heroLeafOffset}>
              <LeafAccent size={12} color={palette.forestLeaf} />
            </View>
          </View>
          <View>
            <Text style={styles.title}>My Classes</Text>
            <Text style={styles.headerSubtitle}>Your learning grove</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button
            variant="secondary"
            size="sm"
            onPress={onJoin}
            style={styles.joinButton}
          >
            Join Class
          </Button>
          <SignOutButton />
        </View>
      </View>
    </View>
  );
}

/* ── Classroom card ── */

function ClassroomCard({
  classroom,
  index,
  onPress,
}: {
  classroom: Classroom;
  index: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const even = index % 2 === 0;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, { toValue: 0.96, duration: motion.fast, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.cardPressable}
    >
      <Animated.View style={[styles.card, elevation.shadowMd, { transform: [{ scale: scaleAnim }] }]}>
        <CardGradientBorder even={even} />
        <View style={styles.cardBody}>
          <View style={styles.cardLeafCorner}>
            <LeafAccent size={12} color={even ? palette.forestLeaf : palette.forestCanopy} />
          </View>
          <TreeIcon size={28} color={even ? palette.forestCanopy : palette.forestLeaf} />
          <View style={styles.cardTextCol}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {classroom.name}
            </Text>
            {classroom.class_code ? (
              <Text style={styles.cardCode} numberOfLines={1}>
                {classroom.class_code}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ── Rich empty state ── */

function ForestEmptyState({ onAction }: { onAction: () => void }) {
  const breathe = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0.7, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [breathe]);

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyForestScene}>
        <View style={styles.emptyMistBg} />
        <View style={styles.emptyTreeRow}>
          <View style={styles.emptyTreeSmallLeft}>
            <TreeIcon size={32} color={palette.forestLayer4} />
          </View>
          <TreeIcon size={56} color={palette.forestCanopy} />
          <View style={styles.emptyTreeSmallRight}>
            <TreeIcon size={38} color={palette.forestLayer5} />
          </View>
        </View>
        <Animated.View style={[styles.emptyLeafLeft, { opacity: breathe }]}>
          <LeafAccent size={12} color={palette.forestLeaf} />
        </Animated.View>
        <Animated.View style={[styles.emptyLeafRight, { opacity: breathe }]}>
          <LeafAccent size={10} color={palette.forestCanopy} />
        </Animated.View>
      </View>

      <Text style={styles.emptyTitle}>No classes yet</Text>
      <Text style={styles.emptyDescription}>
        Join a class with a code from your teacher to get started.
      </Text>
      <Text style={styles.emptyDescSecondary}>
        Your learning journey begins here.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel="Join a Class"
      >
        <Text style={styles.emptyButtonText}>Join a Class</Text>
      </Pressable>
    </View>
  );
}

/* ── Join modal ── */

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
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.96);
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: motion.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

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
        <Pressable style={{ width: "100%", maxWidth: 400 }} onPress={() => {}}>
          <Animated.View style={[styles.modalContent, elevation.shadowLg, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.modalHeader}>
              <LeafAccent size={16} color={palette.forestLeaf} />
              <Text style={styles.modalTitle}>Join a class</Text>
            </View>
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
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Main screen ── */

export default function ClassroomsScreen() {
  const router = useRouter();
  const { classrooms, loading, error, refresh } = useClassrooms();
  const accessToken = useAccessToken() ?? undefined;
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const listFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && !error) {
      listFade.setValue(0);
      Animated.timing(listFade, {
        toValue: 1,
        duration: motion.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, error, listFade]);

  const handleJoined = (classroom: Classroom) => {
    setWelcomeName(classroom.name);
    refresh();
  };

  const dismissWelcome = () => setWelcomeName(null);

  if (loading) {
    return (
      <ScreenContainer>
        <DashboardHeader onJoin={() => setJoinModalVisible(true)} />
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
        <DashboardHeader onJoin={() => setJoinModalVisible(true)} />
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
      <DashboardHeader onJoin={() => setJoinModalVisible(true)} />

      {welcomeName && (
        <Pressable
          style={styles.welcomeBanner}
          onPress={dismissWelcome}
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message">
          <LeafAccent size={16} color={palette.forestLeaf} />
          <Text style={styles.welcomeText}>Welcome to {welcomeName}!</Text>
          <MaterialCommunityIcons name="close" size={18} color={palette.textMuted} />
        </Pressable>
      )}

      <Animated.View style={[styles.listFadeWrap, { opacity: listFade }]}>
        {classrooms.length === 0 ? (
          <ForestEmptyState onAction={() => setJoinModalVisible(true)} />
        ) : (
          <FlatList
            data={classrooms}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <StaggeredCard index={index}>
                <ClassroomCard
                  classroom={item}
                  index={index}
                  onPress={() =>
                    router.push({
                      pathname: "/assignments/[classroomId]",
                      params: { classroomId: item.id, classroomName: item.name },
                    })
                  }
                />
              </StaggeredCard>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Animated.View>

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
  /* ── Header ── */
  header: {
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: radius.organic,
    borderBottomRightRadius: radius.organic,
  },
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.forestGradientStart,
  },
  headerMistLayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: palette.forestMist,
    opacity: 0.4,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroIconCluster: {
    position: "relative",
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  heroLeafOffset: {
    position: "absolute",
    top: -3,
    right: -5,
  },
  headerSubtitle: {
    ...typography.caption,
    color: palette.forestLayer4,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: palette.forestCanopy,
  },
  joinButton: { marginRight: spacing.xs },

  /* ── List ── */
  listFadeWrap: { flex: 1 },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  skeletonList: { padding: spacing.md },

  /* ── Card ── */
  cardPressable: {
    width: "100%",
  },
  card: {
    height: 100,
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    overflow: "hidden",
  },
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
  cardCode: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: 2,
  },

  /* ── Welcome banner ── */
  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.forestMist,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  welcomeText: {
    flex: 1,
    ...typography.bodySmall,
    fontWeight: "600",
    color: palette.forestCanopy,
  },

  /* ── Empty state ── */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyForestScene: {
    position: "relative",
    width: 160,
    height: 90,
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: spacing.lg,
  },
  emptyMistBg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.forestMist,
    opacity: 0.5,
  },
  emptyTreeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  emptyTreeSmallLeft: {
    marginBottom: 4,
  },
  emptyTreeSmallRight: {
    marginBottom: 2,
  },
  emptyLeafLeft: {
    position: "absolute",
    top: 6,
    left: 12,
  },
  emptyLeafRight: {
    position: "absolute",
    top: 12,
    right: 16,
  },
  emptyTitle: {
    ...typography.h2,
    color: palette.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.bodySmall,
    color: palette.textMuted,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  emptyDescSecondary: {
    ...typography.caption,
    color: palette.forestLayer4,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: palette.primary,
    justifyContent: "center",
    marginTop: spacing.md,
  },
  emptyButtonPressed: { opacity: 0.9 },
  emptyButtonText: { ...typography.button, color: palette.textOnPrimary },

  /* ── Sign out ── */
  signOutButton: {
    padding: 10,
    borderRadius: radius.button,
  },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    padding: spacing.lg,
    borderTopWidth: 3,
    borderTopColor: palette.forestCanopy,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  modalTitle: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  modalInputWrap: { marginBottom: spacing.sm },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
});
