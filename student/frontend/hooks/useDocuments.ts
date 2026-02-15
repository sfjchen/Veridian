import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { scopedKey } from '@/lib/scoped-storage';

const LEGACY_KEY = 'veridian_documents';
const PDFS_DIR = 'pdfs';

/** ID and URI prefix for the built-in sample algebra document (no real file). */
export const DEFAULT_DOCUMENT_ID = 'default-algebra';
const DEFAULT_DOCUMENT_URI = 'default://sample-algebra';

export type DocumentMeta = {
  id: string;
  name: string;
  uri: string;
};

export const DEFAULT_DOCUMENT: DocumentMeta = {
  id: DEFAULT_DOCUMENT_ID,
  name: 'Sample Algebra Problems',
  uri: DEFAULT_DOCUMENT_URI,
};

export function isDefaultDocument(doc: DocumentMeta): boolean {
  return doc.id === DEFAULT_DOCUMENT_ID || doc.uri.startsWith('default://');
}

async function ensurePdfsDir(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}${PDFS_DIR}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function pruneStaleDocuments(docs: DocumentMeta[]): Promise<DocumentMeta[]> {
  const results = await Promise.all(
    docs.map(async (doc) => {
      if (isDefaultDocument(doc)) return doc;
      try {
        const info = await FileSystem.getInfoAsync(doc.uri);
        return info.exists ? doc : null;
      } catch {
        return null;
      }
    }),
  );
  const valid = results.filter((d): d is DocumentMeta => d !== null);
  return valid.length > 0 ? valid : [DEFAULT_DOCUMENT];
}

export function useDocuments(userId: string | null) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const storageKey = userId ? scopedKey(userId, LEGACY_KEY) : null;

  const load = useCallback(async () => {
    if (!storageKey) {
      setDocuments([DEFAULT_DOCUMENT]);
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      let raw = await AsyncStorage.getItem(storageKey);
      // Legacy migration: copy unscoped data to scoped key on first load
      if (!raw) {
        const legacy = await AsyncStorage.getItem(LEGACY_KEY);
        if (legacy) {
          await AsyncStorage.setItem(storageKey, legacy);
          await AsyncStorage.removeItem(LEGACY_KEY);
          raw = legacy;
        }
      }
      let list: DocumentMeta[] = raw ? JSON.parse(raw) : [];
      if (list.length === 0) {
        list = [DEFAULT_DOCUMENT];
        await AsyncStorage.setItem(storageKey, JSON.stringify(list));
      }
      if (Platform.OS !== 'web') {
        const validated = await pruneStaleDocuments(list);
        const changed = validated.length !== list.length
          || validated.some((v, i) => v.id !== list[i]?.id);
        if (changed) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(validated));
          list = validated;
        }
      }
      setDocuments(list);
    } catch (e) {
      setDocuments([DEFAULT_DOCUMENT]);
      setLoadError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (list: DocumentMeta[]) => {
    if (!storageKey) return;
    setSaveError(null);
    setDocuments(list);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save document list');
    }
  }, [storageKey]);

  const addDocument = useCallback(async (): Promise<DocumentMeta | null> => {
    setAddError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return null;

      const { uri, name } = result.assets[0];
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const dir = await ensurePdfsDir();
      const destUri = `${dir}${id}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: destUri });

      const meta: DocumentMeta = { id, name: name ?? 'Untitled PDF', uri: destUri };
      await save([...documents, meta]);
      return meta;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add document';
      setAddError(msg);
      return null;
    }
  }, [documents, save]);

  const removeDocument = useCallback(
    async (id: string) => {
      const next = documents.filter((d) => d.id !== id);
      await save(next);
      setRemoveError(null);
      try {
        const doc = documents.find((d) => d.id === id);
        if (doc?.uri) await FileSystem.deleteAsync(doc.uri, { idempotent: true });
      } catch (e) {
        setRemoveError(e instanceof Error ? e.message : 'Failed to delete file');
      }
    },
    [documents, save]
  );

  const getDocument = useCallback(
    (id: string): DocumentMeta | undefined => documents.find((d) => d.id === id),
    [documents]
  );

  return {
    documents,
    loading,
    loadError,
    saveError,
    addError,
    removeError,
    clearLoadError: () => setLoadError(null),
    clearSaveError: () => setSaveError(null),
    clearAddError: () => setAddError(null),
    clearRemoveError: () => setRemoveError(null),
    addDocument,
    removeDocument,
    getDocument,
    refresh: load,
  };
}
