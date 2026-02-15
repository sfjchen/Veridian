import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { CorpusFile } from "../types";

export function useCorpus(classroomId: string) {
  const [files, setFiles] = useState<CorpusFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!classroomId) {
      if (mountedRef.current) {
        setFiles([]);
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<CorpusFile[]>(`/classrooms/${classroomId}/corpus`);
      if (mountedRef.current) setFiles(data ?? []);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch corpus");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { files, loading, error, refresh };
}
