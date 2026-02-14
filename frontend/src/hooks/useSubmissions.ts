import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Submission } from "../types";

export function useSubmissions(assignmentId: string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Submission[]>(`/assignments/${assignmentId}/submissions`);
      setSubmissions(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch submissions";
      setError(message);
      console.error("Failed to fetch submissions:", e);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<Submission[]>(`/assignments/${assignmentId}/submissions`);
        if (!cancelled) setSubmissions(data);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to fetch submissions";
          setError(message);
          console.error("Failed to fetch submissions:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [assignmentId]);

  return { submissions, loading, error, refresh };
}
