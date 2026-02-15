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
  const [error, setError] = useState<string | null>(null);

  const storageKey = userId ? scopedKey(userId, LEGACY_KEY) : null;

  const load = useCallback(async () => {
    if (!storageKey) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      setNotes(raw ? JSON.parse(raw) : []);
    } catch (e) {
      console.warn('[useNotes] Failed to load notes:', e);
      setError(e instanceof Error ? e.message : 'Failed to load notes');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (list: NoteMeta[]) => {
    if (!storageKey) return;
    setNotes(list);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save notes');
    }
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
      await AsyncStorage.removeItem(strokeKeyForNote(userId, id)).catch((e) => {
        console.warn('[useNotes] Failed to remove strokes for note:', id, e);
      });
    }
  }, [notes, save, userId]);

  const getNote = useCallback(
    (id: string): NoteMeta | undefined => notes.find((n) => n.id === id),
    [notes],
  );

  return { notes, loading, error, addNote, removeNote, getNote };
}
