import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { ClassroomStudent } from "../types";

export function useClassroomStudents(classroomId: string) {
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!classroomId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<ClassroomStudent[]>(`/classrooms/${classroomId}/students`);
      if (mountedRef.current) setStudents(data);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to fetch students");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { students, loading, error, refresh };
}
