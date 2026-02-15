import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { Assignment } from "../types";

export function useAssignments(classroomId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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
        setAssignments([]);
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<Assignment[]>(`/classrooms/${classroomId}/assignments`);
      if (mountedRef.current) {
        setAssignments(data ?? []);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch assignments");
        setLoading(false);
      }
    }
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { assignments, loading, error, refresh };
}
