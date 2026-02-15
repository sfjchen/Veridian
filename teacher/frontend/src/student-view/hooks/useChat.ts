import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchChatHistory,
  sendChatMessage,
  type ChatMessage,
} from '../lib/studentApi';

export function useChat(assignmentId: string | null, problemNum: number | null, token?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idCounter = useRef(0);
  const isSending = useRef(false);

  useEffect(() => {
    if (!assignmentId || problemNum == null) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchChatHistory(assignmentId, problemNum, token ?? undefined)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [assignmentId, problemNum, token]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!assignmentId || problemNum == null) return;
      if (isSending.current) return;

      isSending.current = true;
      const optimisticId = `optimistic-${++idCounter.current}`;
      const studentMsg: ChatMessage = {
        id: optimisticId,
        role: 'student',
        content: text,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, studentMsg]);
      setLoading(true);
      setError(null);

      try {
        const response = await sendChatMessage(assignmentId, problemNum, text, token ?? undefined);
        const assistantMsg: ChatMessage = {
          id: `assistant-${++idCounter.current}`,
          role: 'assistant',
          content: response.content,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        isSending.current = false;
      }
    },
    [assignmentId, problemNum, token],
  );

  return { messages, sendMessage, loading, error };
}
