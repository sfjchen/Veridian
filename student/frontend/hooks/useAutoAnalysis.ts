import { useCallback, useEffect, useRef, useState } from 'react';

import { submitAnalysis, type AnalysisResult } from '@/lib/api';
import type { CaptureResult } from '@/lib/capture-types';

export type { CaptureResult } from '@/lib/capture-types';

type AutoAnalysisOpts = {
  assignmentId?: string;
  problemNum?: number;
  isSample?: boolean;
  token?: string;
  debounceMs?: number;
  enabled?: boolean;
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

  const runAnalysis = useCallback(async () => {
    cancel();
    dirtyRef.current = false;
    setError(null);
    setIsAnalyzing(true);
    analyzingRef.current = true;
    const runId = ++runIdRef.current;
    const context = { assignmentId, problemNum };

    try {
      const capture = await captureScreenshot();
      if ('error' in capture) {
        const msg = capture.error === 'unavailable' ? 'Capture unavailable' : 'Capture failed';
        setError(msg);
        onError?.(msg);
        return;
      }
      const result = await submitAnalysis(capture.uri, { assignmentId, problemNum, isSample, token });
      if (runId !== runIdRef.current) return;
      const current = contextRef.current;
      if (contextMatches(result, current.assignmentId, current.problemNum)) {
        setLastResult(result);
      } else {
        onStaleResult?.(result);
      }
    } catch (e) {
      if (runId !== runIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(msg);
    } finally {
      if (runId === runIdRef.current) {
        setIsAnalyzing(false);
        analyzingRef.current = false;
      }
    }
  }, [assignmentId, problemNum, isSample, token, captureScreenshot, cancel, onError, onStaleResult]);

  const markDirty = useCallback(() => {
    if (!enabled) return;
    if (analyzingRef.current) return;
    dirtyRef.current = true;
    cancel();
    timerRef.current = setTimeout(() => {
      if (dirtyRef.current) runAnalysis();
    }, debounceMs);
  }, [enabled, debounceMs, runAnalysis, cancel]);

  useEffect(() => {
    cancel();
    dirtyRef.current = false;
    setError(null);
  }, [assignmentId, problemNum, cancel]);

  useEffect(() => cancel, [cancel]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isAnalyzing,
    lastResult,
    error,
    clearError,
    markDirty,
    triggerNow: runAnalysis,
    cancel,
    setLastResult,
  };
}
