import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Classroom } from "../types";

export function useClassrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Classroom[]>("/classrooms");
      setClassrooms(data);
    } catch (e) {
      console.error("Failed to fetch classrooms:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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

  return { classrooms, loading, refresh, create, join };
}
