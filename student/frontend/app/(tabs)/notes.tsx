import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { palette, radius } from '@/constants/palette';
import { useAuth } from '@/hooks/useAuth';
import { useNotes, type NoteMeta } from '@/hooks/useNotes';

function promptForName(callback: (name: string) => void) {
  const fallback = `Note ${new Date().toLocaleDateString()}`;
  if (Platform.OS === 'ios') {
    Alert.prompt('New Note', 'Enter a name:', (text) => {
      callback(text?.trim() || fallback);
    });
  } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const text = window.prompt('Note name:');
    callback(text?.trim() || fallback);
  } else {
    callback(fallback);
  }
}

function NoteRow({ note, onPress, onDelete }: { note: NoteMeta; onPress: () => void; onDelete: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.rowPressed, opacity: 0.9 }]}
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`Open note ${note.name}`}
      accessibilityHint="Double tap to open. Long press to delete.">
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="notebook-outline" size={28} color={palette.textMuted} />
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>{note.name}</Text>
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
        router.push({ pathname: '/note/[id]', params: { id: note.id } });
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create note');
      }
    });
  };

  const handleDelete = (note: NoteMeta) => {
    Alert.alert('Delete Note', `Delete "${note.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeNote(note.id) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="New Note">
          <MaterialCommunityIcons name="plus" size={22} color={palette.white} />
          <Text style={styles.addButtonText}>New Note</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {notes.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="notebook-outline" size={64} color={palette.borderStrong} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptySubtitle}>Create a note to start writing with autocomplete</Text>
          <Pressable
            style={({ pressed }) => [styles.addButtonLarge, pressed && { opacity: 0.7 }]}
            onPress={handleAdd}>
            <Text style={styles.addButtonText}>New Note</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteRow
              note={item}
              onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
              onDelete={() => handleDelete(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
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
  title: { fontSize: 22, fontWeight: '700', color: palette.textPrimary },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.button,
  },
  addButtonLarge: {
    backgroundColor: palette.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.button,
    marginTop: 16,
  },
  addButtonText: { color: palette.white, fontSize: 15, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    padding: 14,
    borderRadius: radius.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rowIcon: { marginRight: 12 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: palette.textSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: palette.textMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: palette.textSecondary, marginTop: 20 },
  emptySubtitle: { fontSize: 14, color: palette.textMuted, marginTop: 6 },
  errorBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  errorText: { fontSize: 14, color: palette.errorText, textAlign: 'center' },
});
