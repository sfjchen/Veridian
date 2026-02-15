import { useCallback, useRef, useState } from 'react';
import type { Stroke } from '@/components/InkCanvas';
import { captureStrokesAsDataUri } from '@/lib/capture-web';
import { fetchAutocomplete } from '@/lib/api';
import { buildLines, lineKeyFromStrokeIds, type BBox } from '@/lib/line-grouping';
import { latexToText } from '@/lib/latex-to-text';

export type AutocompleteState = {
  suggestion: string | null;
  targetLineBBox: BBox | null;
};

const EMPTY: AutocompleteState = { suggestion: null, targetLineBBox: null };

type AutocompleteOpts = {
  problemContext?: string;
  canvasDims?: { w: number; h: number } | null;
};

export function useStrokeAutocomplete(opts: AutocompleteOpts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const activeSuggestionLineKeyRef = useRef<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(EMPTY);

  const dismiss = useCallback(() => {
    activeSuggestionLineKeyRef.current = null;
    setAutocomplete(EMPTY);
  }, []);

  const onStrokeComplete = useCallback((strokes: Stroke[], completedStrokeId: string) => {
    const { problemContext, canvasDims } = optsRef.current;
    if (!canvasDims || strokes.length === 0) return;

    const { targetLine } = buildLines(strokes, completedStrokeId);
    if (!targetLine) return;

    const lineKey = lineKeyFromStrokeIds(targetLine.strokeIds);
    if (activeSuggestionLineKeyRef.current === lineKey) {
      activeSuggestionLineKeyRef.current = null;
      setAutocomplete(EMPTY);
    }

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
        activeSuggestionLineKeyRef.current = lineKey;
        setAutocomplete({
          suggestion: latexToText(suggestion),
          targetLineBBox: targetLine.bbox,
        });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[autocomplete] Error:', err);
      });
  }, []);

  return { onStrokeComplete, autocomplete, dismiss };
}
