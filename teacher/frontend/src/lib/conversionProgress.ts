import { io, Socket } from "socket.io-client";
import { api } from "./api";

export interface ConversionProgressEvent {
  stage: string;
  progress: number;
  job_id: string;
  current_page?: number;
  total_pages?: number;
  message?: string;
}

interface OpenConversionSocketOptions {
  jobId: string;
  onProgress: (event: ConversionProgressEvent) => void;
  onConnected: (connected: boolean) => void;
}

export interface ConversionSocketHandle {
  close: () => void;
}

const CONNECT_TIMEOUT_MS = 5000;

export async function openConversionSocket(
  options: OpenConversionSocketOptions
): Promise<ConversionSocketHandle> {
  const token = await api.getToken();
  if (!token) {
    throw new Error("Authentication required for conversion progress");
  }

  const { jobId, onProgress, onConnected } = options;

  return new Promise((resolve, reject) => {
    const socket: Socket = io(`${api.baseUrl}/conversion`, {
      auth: { token },
      transports: ["websocket"],
      timeout: CONNECT_TIMEOUT_MS,
    });

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearTimeoutId = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const cleanupConnectListeners = () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
    };

    const handleConnect = () => {
      onConnected(true);
      socket.emit("subscribe", { job_id: jobId });
      if (settled) {
        return;
      }
      settled = true;
      clearTimeoutId();
      cleanupConnectListeners();
      resolve({
        close: () => {
          socket.emit("unsubscribe", { job_id: jobId });
          socket.disconnect();
          onConnected(false);
        },
      });
    };

    const handleConnectError = (error: Error) => {
      onConnected(false);
      if (settled) {
        return;
      }
      settled = true;
      clearTimeoutId();
      cleanupConnectListeners();
      socket.disconnect();
      reject(error);
    };

    socket.on("conversion_progress", (event: ConversionProgressEvent) => {
      if (event.job_id === jobId) {
        onProgress(event);
      }
    });

    socket.on("disconnect", () => {
      onConnected(false);
    });

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);

    timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupConnectListeners();
      socket.disconnect();
      reject(new Error("Timed out connecting to conversion progress server"));
    }, CONNECT_TIMEOUT_MS);
  });
}
