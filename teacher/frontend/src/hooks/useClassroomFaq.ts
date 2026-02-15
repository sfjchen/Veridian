import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { FaqTopic } from "../types";

export function useClassroomFaq(classroomId: string) {
  const [faq, setFaq] = useState<FaqTopic[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
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
        setFaq([]);
        setTotalMessages(0);
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ topics: FaqTopic[]; total_messages?: number }>(`/analytics/classrooms/${classroomId}/faq`);
      if (mountedRef.current) {
        setFaq(data?.topics ?? []);
        setTotalMessages(data?.total_messages ?? 0);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch FAQ data");
        setLoading(false);
      }
    }
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { faq, totalMessages, loading, error, refresh };
}
