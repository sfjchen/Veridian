import { DEFAULT_DOCUMENT_ID } from '@/hooks/useDocuments';

/** Whiteboard-only deploy: skip Supabase sign-in and open the built-in sample worksheet. */
export function isDemoMode(): boolean {
  const v = process.env.EXPO_PUBLIC_DEMO_MODE?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export const DEMO_DOCUMENT_ID = DEFAULT_DOCUMENT_ID;

export function demoDocumentPath(): `/document/${string}` {
  return `/document/${DEMO_DOCUMENT_ID}`;
}
