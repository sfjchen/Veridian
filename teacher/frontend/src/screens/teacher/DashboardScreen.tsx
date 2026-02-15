import React, { useState, useEffect, useRef } from "react";
import { Animated, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useClassrooms } from "../../hooks/useClassrooms";
import { useToast } from "../../contexts/ToastContext";
import { alert } from "../../lib/alert";
import {
  Button,
  Card,
  CopyableBadge,
  EmptyState,
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

const STAGGER_DELAY_MS = 50;

function StaggeredCard({ index, style, children }: { index: number; style?: ViewStyle; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.normal,
      delay: index * STAGGER_DELAY_MS,
      useNativeDriver: true,
    }).start();
  }, [index, opacity]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

export function TeacherDashboardScreen({ navigation }: { navigation: { navigate: (a: string, b: { classroom: { id: string; name: string; class_code: string } }) => void } }) {
  const { classrooms, loading, error, create, refresh } = useClassrooms();

  useFocusEffect(
    React.useCallback(() => {
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
      <View style={styles.header}>
        <View style={styles.heroRow}>
          <LeafAccent size={28} />
          <Text style={styles.hero}>My Classrooms</Text>
        </View>
        <View style={styles.headerActions}>
          <Button onPress={openModal} variant="primary" size="sm" accessibilityLabel="New classroom">
            + New classroom
          </Button>
        </View>
      </View>

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
              <Text style={styles.modalTitle}>New classroom</Text>
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
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardLabel}>Class code</Text>
                  <CopyableBadge text={item.class_code} onCopy={() => showToast("Class code copied")} />
                </Card>
              </StaggeredCard>
            )}
          ListEmptyComponent={
            <EmptyState
              title="No classrooms yet"
              description="Tap “New classroom” to create your first one."
              descriptionSecondary="Create a classroom to share assignments and see how students think."
              icon={
                <View style={styles.emptyIconWrap}>
                  <TreeIcon size={40} color={palette.primary} />
                </View>
              }
              actionLabel="New classroom"
              onAction={openModal}
            />
          }
          />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  hero: {
    ...typography.display,
    color: palette.textPrimary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
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
  },
  modalTitle: {
    ...typography.h1,
    color: palette.textPrimary,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalButton: { flex: 1 },
  listFadeWrap: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  emptyList: { flexGrow: 1 },
  cardRow: { gap: spacing.sm, marginBottom: spacing.sm },
  card: {
    flex: 1,
    minHeight: 120,
    borderTopWidth: 4,
    borderTopColor: palette.forestCanopy,
    borderRadius: radius.organic,
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
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  cardWrapper: { flex: 1 },
});
