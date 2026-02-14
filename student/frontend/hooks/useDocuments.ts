import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';

const DOCUMENTS_KEY = 'veridian_documents';
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

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DOCUMENTS_KEY);
      let list: DocumentMeta[] = raw ? JSON.parse(raw) : [];
      if (list.length === 0) {
        list = [DEFAULT_DOCUMENT];
        await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list));
      }
      setDocuments(list);
    } catch {
      setDocuments([DEFAULT_DOCUMENT]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (list: DocumentMeta[]) => {
    setDocuments(list);
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list));
  }, []);

  const addDocument = useCallback(async (): Promise<DocumentMeta | null> => {
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
    } catch {
      return null;
    }
  }, [documents, save]);

  const removeDocument = useCallback(
    async (id: string) => {
      const next = documents.filter((d) => d.id !== id);
      await save(next);
      try {
        const doc = documents.find((d) => d.id === id);
        if (doc?.uri) await FileSystem.deleteAsync(doc.uri, { idempotent: true });
      } catch {
        // ignore
      }
    },
    [documents, save]
  );

  const getDocument = useCallback(
    (id: string): DocumentMeta | undefined => documents.find((d) => d.id === id),
    [documents]
  );

  return { documents, loading, addDocument, removeDocument, getDocument, refresh: load };
}
