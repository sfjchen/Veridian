import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { scopedKey } from '@/lib/scoped-storage';

const LEGACY_KEY = 'veridian_notes';

export type NoteMeta = { id: string; name: string; createdAt: number };

export function strokeKeyForNote(userId: string, id: string): string {
  return scopedKey(userId, `veridian_strokes:note:${id}`);
}

export function useNotes(userId: string | null) {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const storageKey = userId ? scopedKey(userId, LEGACY_KEY) : null;

  const load = useCallback(async () => {
    if (!storageKey) {
      setNotes([]);
      setLoading(false);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      setNotes(raw ? JSON.parse(raw) : []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (list: NoteMeta[]) => {
    if (!storageKey) return;
    setNotes(list);
    await AsyncStorage.setItem(storageKey, JSON.stringify(list));
  }, [storageKey]);

  const addNote = useCallback(async (name: string): Promise<NoteMeta> => {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const note: NoteMeta = { id, name, createdAt: Date.now() };
    await save([...notes, note]);
    return note;
  }, [notes, save]);

  const removeNote = useCallback(async (id: string) => {
    await save(notes.filter((n) => n.id !== id));
    if (userId) {
      await AsyncStorage.removeItem(strokeKeyForNote(userId, id)).catch(() => {});
    }
  }, [notes, save, userId]);

  const getNote = useCallback(
    (id: string): NoteMeta | undefined => notes.find((n) => n.id === id),
    [notes],
  );

  return { notes, loading, addNote, removeNote, getNote };
}
