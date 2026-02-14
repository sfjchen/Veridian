import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = "5001";

interface ExpoDebugHostConfig {
  expoConfig?: {
    hostUri?: string;
  };
  expoGoConfig?: {
    debuggerHost?: string;
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildApiUrlFromHost(hostWithPort: string): string {
  const host = hostWithPort.split(":")[0];
  return `http://${host}:${API_PORT}`;
}

function resolveDevApiUrl(): string | undefined {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}`;
  }

  const debugConfig = Constants as ExpoDebugHostConfig;
  const hostUri = debugConfig.expoConfig?.hostUri;
  if (hostUri) {
    return buildApiUrlFromHost(hostUri);
  }

  const debuggerHost = debugConfig.expoGoConfig?.debuggerHost;
  if (debuggerHost) {
    return buildApiUrlFromHost(debuggerHost);
  }

  return undefined;
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_API_URL;
const resolvedApiUrl = configuredApiUrl
  ? trimTrailingSlash(configuredApiUrl)
  : process.env.NODE_ENV !== "production"
    ? resolveDevApiUrl()
    : undefined;

if (!resolvedApiUrl) {
  throw new Error("Unable to resolve API URL. Set EXPO_PUBLIC_API_URL.");
}

export const API_URL = resolvedApiUrl;
