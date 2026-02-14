import { useEffect, useState } from 'react';

import { useAccessToken } from '@/hooks/useAccessToken';
import { fetchAssignments, type AssignmentListItem } from '@/lib/api';

export function useAssignments(classroomId: string | null) {
  const token = useAccessToken();
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classroomId) {
      setAssignments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAssignments(classroomId, token ?? undefined)
      .then((list) => {
        if (!cancelled) setAssignments(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load assignments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [classroomId, token]);

  return { assignments, loading, error };
}
