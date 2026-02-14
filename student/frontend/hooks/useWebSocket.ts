import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import type { AnalysisResult } from '@/lib/api';

type WebSocketState = {
  connected: boolean;
  lastResult: AnalysisResult | null;
};

function attachSocketHandlers(
  socket: Socket,
  setConnected: (v: boolean) => void,
  setLastResult: (r: AnalysisResult) => void,
): void {
  socket.on('connect', () => setConnected(true));
  socket.on('disconnect', () => setConnected(false));
  socket.on('result_ready', (data: AnalysisResult) => setLastResult(data));
}

export function useWebSocket(backendUrl: string, token: string): WebSocketState {
  const [connected, setConnected] = useState(false);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!backendUrl || !token) return;

    cleanup();

    const socket = io(backendUrl, {
      transports: ['websocket'],
      auth: { token },
    });

    attachSocketHandlers(socket, setConnected, setLastResult);
    socketRef.current = socket;

    return cleanup;
  }, [backendUrl, token, cleanup]);

  return { connected, lastResult };
}
