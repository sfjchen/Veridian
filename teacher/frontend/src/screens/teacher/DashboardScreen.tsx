import React, { useState, useEffect, useRef } from "react";
import { Animated, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
import { elevation, palette, radius } from "../../constants/palette";
import { motion } from "../../constants/motion";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export function TeacherDashboardScreen({ navigation }: { navigation: { navigate: (a: string, b: { classroom: { id: string; name: string; class_code: string } }) => void } }) {
  const { classrooms, loading, error, create, refresh } = useClassrooms();
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
        duration: 250,
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
        <Text style={styles.hero}>My Classrooms</Text>
        <View style={styles.headerActions}>
          <Button onPress={openModal} variant="primary" size="sm">
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
                  <Button variant="secondary" onPress={closeModal} style={styles.modalButton}>
                    Cancel
                  </Button>
                  <Button onPress={handleCreate} disabled={creating} loading={creating} style={styles.modalButton}>
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
            renderItem={({ item }) => (
            <Card
              onPress={() => navigation.navigate("Classroom", { classroom: item })}
              style={styles.card}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardLabel}>Class code</Text>
              <CopyableBadge text={item.class_code} onCopy={() => showToast("Class code copied")} />
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No classrooms yet"
              description="Tap “New classroom” to create your first one."
              descriptionSecondary="Create a classroom to share assignments and see how students think."
              icon={
                <View style={styles.emptyIconWrap}>
                  <Text style={styles.emptyIconV}>V</Text>
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
    borderRadius: radius.modal,
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
    borderTopColor: palette.primary,
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
  emptyIconV: {
    ...typography.display,
    fontSize: 28,
    color: palette.primary,
  },
});
