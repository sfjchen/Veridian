import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { Submission } from "../types";

export function useSubmissions(assignmentId: string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<Submission[]>(`/assignments/${assignmentId}/submissions`);
      if (mountedRef.current) setSubmissions(data);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch submissions");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { submissions, loading, error, refresh };
}
