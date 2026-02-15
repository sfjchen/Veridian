import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { Classroom } from "../types";

export function useClassrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Classroom[]>("/classrooms");
      if (mountedRef.current) setClassrooms(data);
    } catch (e) {
      if (mountedRef.current) {
        const msg = e instanceof Error ? e.message : (e != null ? String(e) : "");
        setError(msg.trim() || "Failed to fetch classrooms");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (name: string): Promise<Classroom> => {
    const classroom = await api<Classroom>("/classrooms", {
      method: "POST",
      body: { name },
    });
    await refresh();
    return classroom;
  }, [refresh]);

  const join = useCallback(async (classCode: string): Promise<void> => {
    await api("/classrooms/join", {
      method: "POST",
      body: { class_code: classCode },
    });
    await refresh();
  }, [refresh]);

  const deleteClassroom = useCallback(async (id: string): Promise<void> => {
    await api(`/classrooms/${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { classrooms, loading, error, refresh, create, join, deleteClassroom };
}
