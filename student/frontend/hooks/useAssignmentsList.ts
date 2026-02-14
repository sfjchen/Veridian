import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchAssignments, type AssignmentListItem } from '@/lib/api';

export function useAssignmentsList(classroomId: string | null) {
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssignments(classroomId);
      if (mountedRef.current) setAssignments(data);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to fetch assignments');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { assignments, loading, error, refresh };
}
