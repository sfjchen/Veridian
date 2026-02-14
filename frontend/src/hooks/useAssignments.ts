import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Assignment } from "../types";

export function useAssignments(classroomId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Assignment[]>(`/classrooms/${classroomId}/assignments`);
      setAssignments(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch assignments";
      setError(message);
      console.error("Failed to fetch assignments:", e);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { assignments, loading, error, refresh };
}
