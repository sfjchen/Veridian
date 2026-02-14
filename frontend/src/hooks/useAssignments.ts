import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Assignment } from "../types";

export function useAssignments(classroomId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Assignment[]>(`/classrooms/${classroomId}/assignments`);
      setAssignments(data);
    } catch (e) {
      console.error("Failed to fetch assignments:", e);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { assignments, loading, refresh };
}
