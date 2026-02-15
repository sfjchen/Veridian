import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { InkCanvas, type Stroke } from '@/components/InkCanvas';
import { SuggestionGhost } from '@/components/SuggestionGhost';
import { palette } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useAuth } from '@/hooks/useAuth';
import { useNotes, strokeKeyForNote } from '@/hooks/useNotes';
import { useStrokeAutocomplete } from '@/hooks/useStrokeAutocomplete';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { getNote, loading } = useNotes(userId);
  const note = id ? getNote(id) : undefined;

  const STROKES_KEY = (id && userId) ? strokeKeyForNote(userId, id) : null;

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [strokesLoaded, setStrokesLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewShotRef = useRef<ViewShot | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null);

  // --- Stroke persistence ---
  useEffect(() => {
    if (!STROKES_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STROKES_KEY);
        if (!cancelled && raw) setStrokes(JSON.parse(raw) as Stroke[]);
      } catch (e) {
        if (__DEV__) console.warn('[NoteScreen] Failed to load strokes:', e);
      } finally {
        if (!cancelled) setStrokesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [STROKES_KEY]);

  useEffect(() => {
    if (!STROKES_KEY || !strokesLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(STROKES_KEY, JSON.stringify(strokes));
      saveTimeoutRef.current = null;
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [STROKES_KEY, strokesLoaded, strokes]);

  // --- Autocomplete ---
  const { onStrokeComplete, autocomplete, dismiss: dismissAutocomplete } = useStrokeAutocomplete({ canvasDims });

  const handleStrokesChange = useCallback((s: Stroke[]) => {
    setStrokes(s);
    if (s.length === 0) dismissAutocomplete();
  }, [dismissAutocomplete]);

  // --- Render ---
  if (!id || (!loading && !note)) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{id ? 'Note not found' : 'Missing note ID'}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Back to Notes</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{note?.name ?? 'Note'}</Text>
      </View>

      <View style={styles.canvasWrap}>
        <InkCanvas
          viewShotRef={viewShotRef}
          strokes={strokes}
          onStrokesChange={handleStrokesChange}
          onStrokeComplete={onStrokeComplete}
          onCanvasLayout={(w, h) => setCanvasDims({ w, h })}
          showToolbar
          style={styles.canvas}
        />
        {autocomplete.suggestion && autocomplete.targetLineBBox && (
          <SuggestionGhost text={autocomplete.suggestion} lineBBox={autocomplete.targetLineBBox} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerBackBtn: {
    padding: spacing.xs,
    marginRight: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    ...typography.body,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  canvasWrap: { flex: 1, padding: spacing.sm, position: "relative" },
  canvas: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm },
  errorText: { ...typography.body, color: palette.textSecondary, textAlign: "center" },
  backLink: { ...typography.buttonSmall, color: palette.primary },
});
