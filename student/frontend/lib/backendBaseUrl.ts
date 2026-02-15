import Constants from "expo-constants";
import { Platform } from "react-native";

const BACKEND_PORT = "8000";

interface ExpoDebugHostConfig {
  expoConfig?: { hostUri?: string };
  expoGoConfig?: { debuggerHost?: string };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildBackendUrlFromHost(hostWithPort: string): string {
  const host = hostWithPort.split(":")[0];
  return `http://${host}:${BACKEND_PORT}`;
}

function resolveDevBackendUrl(): string | undefined {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:${BACKEND_PORT}`;
  }
  const debugConfig = Constants as ExpoDebugHostConfig;
  const hostUri = debugConfig.expoConfig?.hostUri;
  if (hostUri) return buildBackendUrlFromHost(hostUri);
  const debuggerHost = debugConfig.expoGoConfig?.debuggerHost;
  if (debuggerHost) return buildBackendUrlFromHost(debuggerHost);
  return undefined;
}

const configured = process.env.EXPO_PUBLIC_BACKEND_URL ?? process.env.EXPO_BACKEND_URL;
const trimmedConfigured = configured ? trimTrailingSlash(configured) : undefined;
const devResolved = process.env.NODE_ENV !== "production" ? resolveDevBackendUrl() : undefined;
// Web: use .env URL so browser reaches same-machine backend. Native: prefer Expo host so device/emulator reach host.
const resolved =
  Platform.OS === "web"
    ? (trimmedConfigured ?? devResolved)
    : (devResolved ?? trimmedConfigured);

export const BACKEND_URL = resolved ?? "";
export const BACKEND_URL_MISSING = BACKEND_URL === "";
