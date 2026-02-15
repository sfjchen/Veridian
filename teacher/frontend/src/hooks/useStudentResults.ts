import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { ProblemResult } from "../types";

export function useStudentResults(assignmentId: string, studentId: string) {
  const [results, setResults] = useState<ProblemResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!assignmentId || !studentId) {
      if (mountedRef.current) {
        setResults([]);
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ results: ProblemResult[] }>(
        `/analytics/assignments/${assignmentId}/students/${studentId}/results`
      );
      if (mountedRef.current) {
        setResults(data?.results ?? []);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch results");
        setLoading(false);
      }
    }
  }, [assignmentId, studentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { results, loading, error, refresh };
}
