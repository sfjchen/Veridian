import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { AssignmentTrend } from "../types";

export function useClassroomTrends(classroomId: string) {
  const [trends, setTrends] = useState<AssignmentTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!classroomId) {
      if (mountedRef.current) { setTrends([]); setLoading(false); setError(null); }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ assignments: AssignmentTrend[] }>(`/analytics/classrooms/${classroomId}/trends`);
      if (mountedRef.current) { setTrends(data?.assignments ?? []); setLoading(false); }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch trends");
        setLoading(false);
      }
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { trends, loading, error, refresh };
}
