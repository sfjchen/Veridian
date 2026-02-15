import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, EmptyState, ScreenContainer, SkeletonCard } from "@/components/ui";
import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useAuth } from "@/hooks/useAuth";
import { useNotes, type NoteMeta } from "@/hooks/useNotes";

function promptForName(callback: (name: string) => void) {
  const fallback = `Note ${new Date().toLocaleDateString()}`;
  if (Platform.OS === "ios") {
    Alert.prompt("New Note", "Enter a name:", (text) => {
      callback(text?.trim() || fallback);
    });
  } else if (Platform.OS === "web" && typeof window !== "undefined") {
    const text = window.prompt("Note name:");
    callback(text?.trim() || fallback);
  } else {
    callback(fallback);
  }
}

function NoteRow({
  note,
  onPress,
  onDelete,
}: {
  note: NoteMeta;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: palette.rowPressed, opacity: 0.9 },
      ]}
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
    >
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="notebook-outline" size={28} color={palette.textMuted} />
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {note.name}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={palette.textDisabled} />
    </Pressable>
  );
}

export default function NotesScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { notes, loading, error, addNote, removeNote } = useNotes(userId);

  const handleAdd = () => {
    promptForName(async (name) => {
      try {
        const note = await addNote(name);
        router.push({ pathname: "/note/[id]", params: { id: note.id } });
      } catch (e) {
        Alert.alert("Error", e instanceof Error ? e.message : "Failed to create note");
      }
    });
  };

  const handleDelete = (note: NoteMeta) => {
    Alert.alert("Delete Note", `Delete "${note.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeNote(note.id) },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Notes</Text>
        </View>
        <View style={styles.skeletonList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <Button size="sm" onPress={handleAdd} accessibilityLabel="New Note">
          New Note
        </Button>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Create a note to start writing with autocomplete."
          actionLabel="New Note"
          onAction={handleAdd}
        />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteRow
              note={item}
              onPress={() => router.push({ pathname: "/note/[id]", params: { id: item.id } })}
              onDelete={() => handleDelete(item)}
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
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.card,
  },
  title: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.card,
    padding: 14,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rowIcon: { marginRight: spacing.sm },
  rowTitle: {
    flex: 1,
    ...typography.body,
    fontWeight: "500",
    color: palette.textSecondary,
  },
  skeletonList: { padding: spacing.md },
  errorBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.errorBg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  errorText: {
    ...typography.bodySmall,
    color: palette.error,
    textAlign: "center",
  },
});
