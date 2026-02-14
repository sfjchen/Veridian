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
import { useDocuments, type DocumentMeta } from '@/hooks/useDocuments';

function DocumentRow({
  doc,
  onPress,
}: {
  doc: DocumentMeta;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: palette.rowPressed, opacity: 0.9 },
      ]}
      onPress={onPress}
      accessibilityRole="button">
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="file-document-outline" size={28} color={palette.textMuted} />
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {doc.name}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={palette.textDisabled} />
    </Pressable>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { documents, loading, addDocument } = useDocuments();

  const handleAdd = async () => {
    const added = await addDocument();
    if (added) router.push({ pathname: '/document/[id]', params: { id: added.id } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Loading documents…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.workspaceButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/WorkspaceScreen')}
            accessibilityRole="button"
            accessibilityLabel="Whiteboard">
            <MaterialCommunityIcons name="draw" size={20} color={palette.primary} />
            <Text style={styles.workspaceButtonText}>Workspace</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
            onPress={handleAdd}
            accessibilityRole="button"
            accessibilityLabel="Add PDF">
            <MaterialCommunityIcons name="plus" size={22} color={palette.white} />
            <Text style={styles.addButtonText}>Add PDF</Text>
          </Pressable>
        </View>
      </View>

      {documents.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={palette.borderStrong} />
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySubtitle}>Add a PDF to start your math homework</Text>
          <Pressable
            style={({ pressed }) => [styles.addButtonLarge, pressed && { opacity: 0.7 }]}
            onPress={handleAdd}>
            <Text style={styles.addButtonText}>Add PDF</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DocumentRow
              doc={item}
              onPress={() => router.push({ pathname: '/document/[id]', params: { id: item.id } })}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  addButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
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
  rowIcon: {
    marginRight: 12,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: palette.textSecondary,
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
  },
});
