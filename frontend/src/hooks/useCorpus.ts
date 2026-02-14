import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { CorpusFile } from "../types";

export function useCorpus(classroomId: string) {
  const [files, setFiles] = useState<CorpusFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<CorpusFile[]>(`/classrooms/${classroomId}/corpus`);
      setFiles(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch corpus";
      setError(message);
      console.error("Failed to fetch corpus:", e);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<CorpusFile[]>(`/classrooms/${classroomId}/corpus`);
        if (!cancelled) setFiles(data);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to fetch corpus";
          setError(message);
          console.error("Failed to fetch corpus:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [classroomId]);

  return { files, loading, error, refresh };
}
