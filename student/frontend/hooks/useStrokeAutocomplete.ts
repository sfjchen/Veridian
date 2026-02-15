import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Stroke } from '@/components/InkCanvas';
import { captureStrokesAsDataUri } from '@/lib/capture-web';
import { fetchAutocomplete } from '@/lib/api';
import { buildLines, lineKeyFromStrokeIds, type BBox } from '@/lib/line-grouping';
import { latexToText } from '@/lib/latex-to-text';

export type AutocompleteState = {
  suggestion: string | null;
  targetLineBBox: BBox | null;
  targetLineKey: string | null;
};

const EMPTY: AutocompleteState = { suggestion: null, targetLineBBox: null, targetLineKey: null };

type AutocompleteOpts = {
  problemContext?: string;
  canvasDims?: { w: number; h: number } | null;
  completedLineKeys?: Set<string>;
};

export function useStrokeAutocomplete(opts: AutocompleteOpts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(EMPTY);

  const dismiss = useCallback(() => setAutocomplete(EMPTY), []);

  const onStrokeComplete = useCallback((strokes: Stroke[], completedStrokeId: string) => {
    if (Platform.OS !== 'web') return;
    const { problemContext, canvasDims, completedLineKeys } = optsRef.current;
    if (!canvasDims || strokes.length === 0) return;

    const { targetLine } = buildLines(strokes, completedStrokeId);
    if (!targetLine) return;

    const lineKey = lineKeyFromStrokeIds(targetLine.strokeIds);
    if (completedLineKeys?.has(lineKey)) return;

    // Dismiss if new stroke is on the same line as current suggestion
    setAutocomplete((prev) =>
      prev.targetLineKey === lineKey ? EMPTY : prev,
    );

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const reqId = ++requestIdRef.current;

    const canvasImage = captureStrokesAsDataUri(strokes, canvasDims.w, canvasDims.h);

    fetchAutocomplete(canvasImage, problemContext ?? '', controller.signal)
      .then(({ suggestion, ms }) => {
        if (requestIdRef.current !== reqId) return;
        console.log(`[autocomplete] (${ms}ms): ${suggestion || '(empty)'}`);
        if (!suggestion) return;
        setAutocomplete({
          suggestion: latexToText(suggestion),
          targetLineBBox: targetLine.bbox,
          targetLineKey: lineKey,
        });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[autocomplete] Error:', err);
      });
  }, []);

  return { onStrokeComplete, autocomplete, dismiss };
}
