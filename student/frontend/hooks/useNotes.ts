import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const NOTES_KEY = 'veridian_notes';

export type NoteMeta = { id: string; name: string; createdAt: number };

export function strokeKeyForNote(id: string): string {
  return `veridian_strokes:note:${id}`;
}

export function useNotes() {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTES_KEY);
      setNotes(raw ? JSON.parse(raw) : []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (list: NoteMeta[]) => {
    setNotes(list);
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(list));
  }, []);

  const addNote = useCallback(async (name: string): Promise<NoteMeta> => {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const note: NoteMeta = { id, name, createdAt: Date.now() };
    await save([...notes, note]);
    return note;
  }, [notes, save]);

  const removeNote = useCallback(async (id: string) => {
    await save(notes.filter((n) => n.id !== id));
    await AsyncStorage.removeItem(strokeKeyForNote(id)).catch(() => {});
  }, [notes, save]);

  const getNote = useCallback(
    (id: string): NoteMeta | undefined => notes.find((n) => n.id === id),
    [notes],
  );

  return { notes, loading, addNote, removeNote, getNote };
}
