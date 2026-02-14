import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { CorpusFile } from "../types";

export function useCorpus(classroomId: string) {
  const [files, setFiles] = useState<CorpusFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<CorpusFile[]>(`/classrooms/${classroomId}/corpus`);
      setFiles(data);
    } catch (e) {
      console.error("Failed to fetch corpus:", e);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { files, loading, refresh };
}
