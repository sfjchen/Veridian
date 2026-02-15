import React, { useState, useEffect, useRef, useCallback } from "react";
import { Animated, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useClassrooms } from "../../hooks/useClassrooms";
import { useToast } from "../../contexts/ToastContext";
import { alert } from "../../lib/alert";
import {
  Button,
  Card,
  CopyableBadge,
  Input,
  ScreenContainer,
  SkeletonCard,
  ErrorState,
  Section,
} from "../../components/ui";
import { TreeIcon, LeafAccent } from "../../components/forest";
import { elevation, palette, radius } from "../../constants/palette";
import { motion } from "../../constants/motion";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

const STAGGER_DELAY_MS = 60;

/* ── Animated classroom card with stagger + press feedback ── */

function StaggeredCard({ index, style, children }: { index: number; style?: ViewStyle; children: React.ReactNode }) {
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
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/* ── Gradient-style top border (two-tone) ── */

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

/* ── Forest-themed header ── */

function DashboardHeader({ onNew }: { onNew: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBg}>
        <View style={styles.headerMistLayer} />
      </View>
      <View style={styles.headerContent}>
        <View style={styles.heroRow}>
          <View style={styles.heroIconCluster}>
            <TreeIcon size={28} color={palette.forestCanopy} />
            <View style={styles.heroLeafOffset}>
              <LeafAccent size={16} color={palette.forestLeaf} />
            </View>
          </View>
          <View>
            <Text style={styles.hero}>My Classrooms</Text>
            <Text style={styles.heroSubtitle}>Manage your teaching forest</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button onPress={onNew} variant="primary" size="sm" accessibilityLabel="New classroom">
            + New classroom
          </Button>
        </View>
      </View>
    </View>
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
        {/* Mist layer behind trees */}
        <View style={styles.emptyMistBg} />

        {/* Tree cluster */}
        <View style={styles.emptyTreeRow}>
          <View style={styles.emptyTreeSmallLeft}>
            <TreeIcon size={36} color={palette.forestLayer4} />
          </View>
          <TreeIcon size={64} color={palette.forestCanopy} />
          <View style={styles.emptyTreeSmallRight}>
            <TreeIcon size={44} color={palette.forestLayer5} />
          </View>
        </View>

        {/* Floating leaves */}
        <Animated.View style={[styles.emptyLeafLeft, { opacity: breathe }]}>
          <LeafAccent size={14} color={palette.forestLeaf} />
        </Animated.View>
        <Animated.View style={[styles.emptyLeafRight, { opacity: breathe }]}>
          <LeafAccent size={10} color={palette.forestCanopy} />
        </Animated.View>
      </View>

      <Text style={styles.emptyTitle}>Plant your first classroom</Text>
      <Text style={styles.emptyDescription}>
        Create a classroom to share assignments and watch your students grow.
      </Text>
      <Text style={styles.emptyDescSecondary}>
        Every great forest starts with a single seed.
      </Text>
      <Button onPress={onAction} variant="primary" style={styles.emptyButton}>
        + New classroom
      </Button>
    </View>
  );
}

/* ── Main screen ── */

export function TeacherDashboardScreen({ navigation }: { navigation: { navigate: (a: string, b: { classroom: { id: string; name: string; class_code: string } }) => void } }) {
  const { classrooms, loading, error, create, refresh } = useClassrooms();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const { showToast } = useToast();
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const openModal = () => {
    setNewName("");
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const modalScale = useRef(new Animated.Value(0.96)).current;
  const listFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (modalVisible) {
      modalScale.setValue(0.96);
      Animated.timing(modalScale, {
        toValue: 1,
        duration: motion.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [modalVisible, modalScale]);

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

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      alert("Error", "Classroom name cannot be empty");
      return;
    }
    setCreating(true);
    try {
      await create(trimmed);
      setNewName("");
      closeModal();
      showToast("Classroom created");
    } catch (e: unknown) {
      alert("Error", e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenContainer maxWidth="dashboard">
      <DashboardHeader onNew={openModal} />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeModal}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <Animated.View style={[styles.modalCard, elevation.shadowLg, { transform: [{ scale: modalScale }] }]}>
              <View style={styles.modalHeader}>
                <LeafAccent size={18} color={palette.forestLeaf} />
                <Text style={styles.modalTitle}>New classroom</Text>
              </View>
              <Section>
                <Input
                  placeholder="Classroom name"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <View style={styles.modalActions}>
                  <Button variant="secondary" onPress={closeModal} style={styles.modalButton} accessibilityLabel="Cancel">
                    Cancel
                  </Button>
                  <Button onPress={handleCreate} disabled={creating} loading={creating} style={styles.modalButton} accessibilityLabel="Create classroom">
                    Create
                  </Button>
                </View>
              </Section>
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <Animated.View style={[styles.listFadeWrap, { opacity: listFade }]}>
          <FlatList
            data={classrooms}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={classrooms.length > 0 ? styles.cardRow : undefined}
            contentContainerStyle={classrooms.length === 0 ? styles.emptyList : styles.list}
            renderItem={({ item, index }) => (
              <StaggeredCard index={index} style={styles.cardWrapper}>
                <Card
                  onPress={() => navigation.navigate("Classroom", { classroom: item })}
                  style={styles.card}
                >
                  <CardGradientBorder even={index % 2 === 0} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeafCorner}>
                      <LeafAccent size={14} color={index % 2 === 0 ? palette.forestLeaf : palette.forestCanopy} />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cardLabel}>Class code</Text>
                    <CopyableBadge text={item.class_code} onCopy={() => showToast("Class code copied")} />
                  </View>
                </Card>
              </StaggeredCard>
            )}
            ListEmptyComponent={<ForestEmptyState onAction={openModal} />}
          />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  /* ── Header ── */
  header: {
    position: "relative",
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
    overflow: "hidden",
    borderRadius: radius.organic,
  },
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.forestGradientStart,
    borderRadius: radius.organic,
  },
  headerMistLayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: palette.forestMist,
    opacity: 0.4,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroIconCluster: {
    position: "relative",
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  heroLeafOffset: {
    position: "absolute",
    top: -4,
    right: -6,
  },
  hero: {
    ...typography.display,
    color: palette.forestCanopy,
  },
  heroSubtitle: {
    ...typography.caption,
    color: palette.forestLayer4,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  /* ── Modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: palette.card,
    borderRadius: radius.organic,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
    borderTopWidth: 3,
    borderTopColor: palette.forestCanopy,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalButton: { flex: 1 },

  /* ── List / Grid ── */
  listFadeWrap: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  emptyList: { flexGrow: 1 },
  cardRow: { gap: spacing.sm, marginBottom: spacing.sm },
  cardWrapper: { flex: 1 },

  /* ── Card ── */
  card: {
    flex: 1,
    minHeight: 140,
    borderRadius: radius.organic,
    padding: 0,
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
    paddingTop: spacing.sm,
    position: "relative",
  },
  cardLeafCorner: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    opacity: 0.6,
  },
  cardTitle: {
    ...typography.h2,
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  cardLabel: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.xxs,
  },

  /* ── Empty state ── */
  emptyContainer: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  emptyForestScene: {
    position: "relative",
    width: 180,
    height: 100,
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: spacing.lg,
  },
  emptyMistBg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderRadius: 20,
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
    top: 8,
    left: 16,
  },
  emptyLeafRight: {
    position: "absolute",
    top: 14,
    right: 20,
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
    marginTop: spacing.md,
  },
});
