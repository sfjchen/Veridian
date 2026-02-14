import { useEffect, useState } from 'react';

import { fetchAssignment, type Assignment, type Problem } from '@/lib/api';

export function useAssignment(assignmentId: string | null) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) {
      setAssignment(null);
      setProblems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAssignment(assignmentId)
      .then((a) => {
        if (cancelled) return;
        setAssignment(a);
        setProblems(a.problems ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [assignmentId]);

  return { assignment, problems, loading, error };
}
