import { useCallback, useEffect, useRef, useState } from 'react';

import { submitAnalysis, type AnalysisResult } from '@/lib/api';

type AutoAnalysisOpts = {
  assignmentId?: string;
  problemNum?: number;
  isSample?: boolean;
  debounceMs?: number;
  enabled?: boolean;
  captureScreenshot: () => Promise<string | null>;
  onError?: (error: string) => void;
};

export function useAutoAnalysis({
  assignmentId,
  problemNum,
  isSample,
  debounceMs = 15_000,
  enabled = true,
  captureScreenshot,
  onError,
}: AutoAnalysisOpts) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    cancel();
    dirtyRef.current = false;
    setError(null);
    setIsAnalyzing(true);

    try {
      const uri = await captureScreenshot();
      if (!uri) {
        onError?.('Capture failed. Canvas may not be ready yet.');
        setIsAnalyzing(false);
        return;
      }
      const result = await submitAnalysis(uri, { assignmentId, problemNum, isSample });
      setLastResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [assignmentId, problemNum, isSample, captureScreenshot, cancel, onError]);

  const markDirty = useCallback(() => {
    if (!enabled) return;
    dirtyRef.current = true;
    cancel();
    timerRef.current = setTimeout(() => {
      if (dirtyRef.current) runAnalysis();
    }, debounceMs);
  }, [enabled, debounceMs, runAnalysis, cancel]);

  // Cancel pending timer when problem context changes to prevent stale submissions.
  useEffect(() => {
    cancel();
    dirtyRef.current = false;
  }, [assignmentId, problemNum, cancel]);

  useEffect(() => cancel, [cancel]);

  return {
    isAnalyzing,
    lastResult,
    error,
    markDirty,
    triggerNow: runAnalysis,
    cancel,
    setLastResult,
  };
}
