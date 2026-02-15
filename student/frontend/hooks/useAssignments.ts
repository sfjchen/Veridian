import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccessToken } from '@/hooks/useAccessToken';
import { fetchAssignments, type AssignmentListItem } from '@/lib/api';

export function useAssignments(classroomId: string | null) {
  const token = useAccessToken();
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!classroomId) {
      if (mountedRef.current) {
        setAssignments([]);
        setError(null);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAssignments(classroomId, token ?? undefined);
      if (mountedRef.current) setAssignments(list);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { assignments, loading, error, refresh };
}
