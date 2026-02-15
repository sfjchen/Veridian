import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccessToken } from '@/hooks/useAccessToken';
import { fetchClassrooms, type Classroom } from '@/lib/api';

export function useClassrooms() {
  const token = useAccessToken();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
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
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClassrooms(token);
      if (mountedRef.current) setClassrooms(data);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to fetch classrooms');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(true);
      return;
    }
    refresh();
  }, [refresh, token]);

  return { classrooms, loading, error, refresh };
}
