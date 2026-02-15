import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { MistakeHeatmapResponse } from "../types";

export function useMistakeHeatmap(classroomId: string) {
  const [heatmap, setHeatmap] = useState<MistakeHeatmapResponse | null>(null);
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
        setHeatmap(null);
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<MistakeHeatmapResponse>(`/analytics/classrooms/${classroomId}/mistakes`);
      if (mountedRef.current) {
        setHeatmap(data ?? null);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch mistake data");
        setLoading(false);
      }
    }
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { heatmap, loading, error, refresh };
}
