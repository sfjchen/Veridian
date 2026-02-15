import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { ClassroomOverview } from "../types";

export function useClassroomOverview(classroomId: string) {
  const [overview, setOverview] = useState<ClassroomOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!classroomId) {
      if (mountedRef.current) { setOverview(null); setLoading(false); setError(null); }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<ClassroomOverview>(`/analytics/classrooms/${classroomId}/overview`);
      if (mountedRef.current) { setOverview(data ?? null); setLoading(false); }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch overview");
        setLoading(false);
      }
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { overview, loading, error, refresh };
}
