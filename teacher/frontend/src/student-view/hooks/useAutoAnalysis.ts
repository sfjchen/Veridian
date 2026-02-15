import { useCallback, useEffect, useRef, useState } from 'react';

import { submitAnalysis, type AnalysisResult } from '../lib/studentApi';
import type { CaptureResult } from '../lib/capture-types';
import type { AnalysisTrigger } from '../lib/teacherConfig';

export type { CaptureResult } from '../lib/capture-types';

type AutoAnalysisOpts = {
  assignmentId?: string;
  problemNum?: number;
  isSample?: boolean;
  token?: string;
  debounceMs?: number;
  enabled?: boolean;
  mode?: AnalysisTrigger;
  captureScreenshot: () => Promise<CaptureResult>;
  onError?: (error: string) => void;
  onStaleResult?: (result: AnalysisResult) => void;
};

function contextMatches(
  result: AnalysisResult,
  assignmentId: string | undefined,
  problemNum: number | undefined,
): boolean {
  const rNum = result.problem_num;
  if (assignmentId !== undefined && result.assignment_id !== assignmentId) return false;
  if (problemNum !== undefined && (rNum === undefined || rNum !== problemNum)) return false;
  return true;
}

export function useAutoAnalysis({
  assignmentId,
  problemNum,
  isSample,
  token,
  debounceMs = 15_000,
  enabled = true,
  mode = 'auto_idle',
  captureScreenshot,
  onError,
  onStaleResult,
}: AutoAnalysisOpts) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const runIdRef = useRef(0);
  const analyzingRef = useRef(false);
  const contextRef = useRef({ assignmentId, problemNum });

  contextRef.current = { assignmentId, problemNum };

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runAnalysis = useCallback(async (isManual = false): Promise<boolean> => {
    if (mode === 'passive') return false;
    if (!enabled && !isManual) return false;
    cancel();
    dirtyRef.current = false;
    setError(null);
    setIsAnalyzing(true);
    analyzingRef.current = true;
    const runId = ++runIdRef.current;

    try {
      const capture = await captureScreenshot();
      if ('error' in capture) {
        const msg = capture.error === 'unavailable' ? 'Capture unavailable' : 'Capture failed';
        setError(msg);
        onError?.(msg);
        if (runId === runIdRef.current) {
          setIsAnalyzing(false);
          analyzingRef.current = false;
        }
        return false;
      }
      const result = await submitAnalysis(capture.uri, { assignmentId, problemNum, isSample, token });
      if (runId !== runIdRef.current) return false;
      const current = contextRef.current;
      if (contextMatches(result, current.assignmentId, current.problemNum)) {
        setLastResult(result);
      } else {
        onStaleResult?.(result);
      }
      return true;
    } catch (e) {
      if (runId !== runIdRef.current) return false;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(msg);
      return false;
    } finally {
      if (runId === runIdRef.current) {
        setIsAnalyzing(false);
        analyzingRef.current = false;
      }
    }
  }, [assignmentId, problemNum, isSample, token, captureScreenshot, cancel, enabled, mode, onError, onStaleResult]);

  const markDirty = useCallback(() => {
    if (!enabled || mode === 'passive') return;
    dirtyRef.current = true;
    if (analyzingRef.current) return;
    cancel();
    if (mode !== 'auto_idle') return;
    timerRef.current = setTimeout(() => {
      if (dirtyRef.current) {
        void runAnalysis();
      }
    }, debounceMs);
  }, [enabled, mode, debounceMs, runAnalysis, cancel]);

  const triggerOnPageChange = useCallback((): void => {
    if (!enabled || mode !== 'auto_page_change') return;
    if (!dirtyRef.current || analyzingRef.current) return;
    void runAnalysis();
  }, [enabled, mode, runAnalysis]);

  useEffect(() => {
    cancel();
    dirtyRef.current = false;
    setError(null);
  }, [assignmentId, problemNum, mode, cancel]);

  useEffect(() => cancel, [cancel]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const triggerNow = useCallback(() => {
    void runAnalysis(true);
  }, [runAnalysis]);

  return {
    isAnalyzing,
    lastResult,
    error,
    clearError,
    markDirty,
    triggerNow,
    triggerOnPageChange,
    cancel,
    setLastResult,
  };
}
