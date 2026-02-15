import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tokenFromValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const token = tokenFromValue(item);
      if (token) return token;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  const direct = value.access_token;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const currentSessionToken = tokenFromValue(value.currentSession);
  if (currentSessionToken) return currentSessionToken;

  const sessionToken = tokenFromValue(value.session);
  if (sessionToken) return sessionToken;

  return null;
}

function parseStoredToken(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && trimmed.split('.').length === 3) {
    return trimmed;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return tokenFromValue(parsed);
  } catch {
    return null;
  }
}

function getSupabaseAuthStorageKeys(): string[] {
  const keys = ['supabase.auth.token'];
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  if (!url) return keys;

  try {
    const projectRef = new URL(url).hostname.split('.')[0];
    if (projectRef) {
      keys.unshift(`sb-${projectRef}-auth-token`);
    }
  } catch {
    return keys;
  }

  return keys;
}

async function readWebStorageToken(keys: string[]): Promise<string | null> {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  for (const key of keys) {
    const token = parseStoredToken(window.localStorage.getItem(key));
    if (token) return token;
  }
  return null;
}

async function readNativeStorageToken(keys: string[]): Promise<string | null> {
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key);
    const token = parseStoredToken(raw);
    if (token) return token;
  }
  return null;
}

export async function getSessionAccessToken(): Promise<string | undefined> {
  const keys = getSupabaseAuthStorageKeys();
  const token = Platform.OS === 'web'
    ? await readWebStorageToken(keys)
    : await readNativeStorageToken(keys);
  return token ?? undefined;
}
