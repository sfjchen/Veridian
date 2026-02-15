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
const SUBSCRIBE_RETRY_INTERVAL_MS = 500;
const SUBSCRIBE_RETRY_MAX_ATTEMPTS = 12;

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
    let subscribeRetryId: ReturnType<typeof setInterval> | null = null;
    let subscribeAttempts = 0;
    let hasReceivedProgress = false;

    const clearTimeoutId = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const clearSubscribeRetryId = () => {
      if (subscribeRetryId) {
        clearInterval(subscribeRetryId);
        subscribeRetryId = null;
      }
    };

    const subscribeToJob = () => {
      if (!socket.connected) {
        return;
      }
      socket.emit("subscribe", { job_id: jobId });
    };

    const startSubscribeRetry = () => {
      subscribeAttempts = 0;
      clearSubscribeRetryId();
      subscribeToJob();
      subscribeRetryId = setInterval(() => {
        if (!socket.connected || hasReceivedProgress) {
          clearSubscribeRetryId();
          return;
        }
        subscribeAttempts += 1;
        if (subscribeAttempts >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) {
          clearSubscribeRetryId();
          return;
        }
        subscribeToJob();
      }, SUBSCRIBE_RETRY_INTERVAL_MS);
    };

    const cleanupConnectListeners = () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
    };

    const handleConnect = () => {
      onConnected(true);
      hasReceivedProgress = false;
      startSubscribeRetry();
      if (settled) {
        return;
      }
      settled = true;
      clearTimeoutId();
      cleanupConnectListeners();
      resolve({
        close: () => {
          clearSubscribeRetryId();
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
      clearSubscribeRetryId();
      cleanupConnectListeners();
      socket.disconnect();
      reject(error);
    };

    socket.on("conversion_progress", (event: ConversionProgressEvent) => {
      if (event.job_id === jobId) {
        hasReceivedProgress = true;
        clearSubscribeRetryId();
        onProgress(event);
      }
    });

    socket.on("disconnect", () => {
      clearSubscribeRetryId();
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
      clearSubscribeRetryId();
      socket.disconnect();
      reject(new Error("Timed out connecting to conversion progress server"));
    }, CONNECT_TIMEOUT_MS);
  });
}
