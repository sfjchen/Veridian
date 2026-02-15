import { useEffect, useState } from 'react';

import { fetchAssignment, type Assignment, type Problem } from '@/lib/api';
import { getSessionAccessToken } from '@/lib/sessionToken';

export function useAssignment(assignmentId: string | null) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) {
      setAssignment(null);
      setProblems([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const accessToken = await getSessionAccessToken();
        const a = await fetchAssignment(assignmentId, accessToken);
        if (cancelled) return;
        setAssignment(a);
        setProblems(a.problems ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [assignmentId]);

  return { assignment, problems, loading, error };
}
