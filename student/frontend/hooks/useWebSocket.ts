import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ResultPayload = {
  assignment_id: string;
  problem_num: number;
  status: string;
  mistake_count: number;
  mistakes: any[];
};

export function useWebSocket(
  url: string,
  token: string | null,
  onResult: (data: ResultPayload) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    const socket = io(url, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('result_ready', (data: ResultPayload) => {
      onResult(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [url, token, onResult]);

  return { connected };
}
