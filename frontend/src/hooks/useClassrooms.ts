import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Classroom } from "../types";

export function useClassrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Classroom[]>("/classrooms");
      setClassrooms(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch classrooms";
      setError(message);
      console.error("Failed to fetch classrooms:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<Classroom[]>("/classrooms");
        if (!cancelled) setClassrooms(data);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to fetch classrooms";
          setError(message);
          console.error("Failed to fetch classrooms:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const create = async (name: string): Promise<Classroom> => {
    const classroom = await api<Classroom>("/classrooms", {
      method: "POST",
      body: { name },
    });
    await refresh();
    return classroom;
  };

  const join = async (classCode: string): Promise<void> => {
    await api("/classrooms/join", {
      method: "POST",
      body: { class_code: classCode },
    });
    await refresh();
  };

  return { classrooms, loading, error, refresh, create, join };
}
