import { supabase } from '../../lib/supabase';
import type { ResolvedConfig } from './teacherConfig';

const STUDENT_API_URL = (() => {
  const explicit = process.env.EXPO_PUBLIC_STUDENT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const teacherUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (teacherUrl) {
    try {
      const url = new URL(teacherUrl);
      url.port = '8000';
      return url.origin;
    } catch { /* fall through */ }
  }
  return 'http://localhost:8000';
})();

async function getToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? undefined;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const b = await res.json();
    return b.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error('Network error: unable to reach the student backend. Check your connection.');
    }
    throw e;
  }
}

export type MistakeDot = { x: number; y: number };

export type Mistake = {
  id: string;
  content: string;
  explanation: string;
  tag: string;
  severity: string;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  dot?: MistakeDot;
};

export type AnalysisResult = {
  student_tex: string;
  annotated_tex: string;
  continuation_tex: string;
  mistake_count: number | null;
  mistakes: Mistake[];
  problem_num?: number;
  assignment_id?: string;
  hint_level?: string;
};

export type ChatMessage = {
  id: string;
  role: 'student' | 'assistant';
  content: string;
  created_at: string;
};

export type ChatResponse = {
  role: 'assistant';
  content: string;
  problem_num: number;
  assignment_id: string;
};

export type Problem = {
  num: number;
  statement_tex: string;
};

export type Assignment = {
  id: string;
  title: string;
  problems: Problem[];
  reveal_mode?: 'single-tap' | 'progressive';
  resolved_config?: Partial<ResolvedConfig>;
};

export function getAuthHeaders(accessToken?: string): Record<string, string> {
  const token = accessToken ?? process.env.EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN?.trim();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export async function fetchAssignment(assignmentId: string): Promise<Assignment> {
  const token = await getToken();
  const res = await safeFetch(`${STUDENT_API_URL}/assignments/${assignmentId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to fetch assignment'));
  const data = await res.json();
  return data.assignment;
}

export async function fetchProblems(assignmentId: string): Promise<Problem[]> {
  const token = await getToken();
  const res = await safeFetch(`${STUDENT_API_URL}/assignments/${assignmentId}/problems`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to fetch problems'));
  const data = await res.json();
  return data.problems ?? [];
}

function dataUriToBlob(dataUri: string): Blob {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function submitAnalysis(
  imageUri: string,
  opts: { assignmentId?: string; problemNum?: number; isSample?: boolean; sampleSlug?: string; token?: string },
): Promise<AnalysisResult> {
  const token = opts.token ?? (await getToken());
  const formData = new FormData();

  if (imageUri.startsWith('data:')) {
    formData.append('image', dataUriToBlob(imageUri), 'screenshot.png');
  } else {
    formData.append('image', {
      uri: imageUri,
      name: 'screenshot.png',
      type: 'image/png',
    } as any);
  }

  if (opts.assignmentId) formData.append('assignment_id', opts.assignmentId);
  if (opts.problemNum != null) formData.append('problem_num', String(opts.problemNum));
  if (opts.isSample) formData.append('is_sample', 'true');
  if (opts.sampleSlug) formData.append('sample_slug', opts.sampleSlug);

  const res = await safeFetch(`${STUDENT_API_URL}/analyze-solution`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(await extractError(res, 'Analysis failed'));
  return await res.json();
}

export async function sendChatMessage(
  assignmentId: string,
  problemNum: number,
  message: string,
  token?: string,
): Promise<ChatResponse> {
  const resolvedToken = token ?? (await getToken());
  const res = await safeFetch(`${STUDENT_API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(resolvedToken) },
    body: JSON.stringify({ assignment_id: assignmentId, problem_num: problemNum, message }),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Chat failed'));
  return await res.json();
}

export async function fetchChatHistory(
  assignmentId: string,
  problemNum: number,
  token?: string,
): Promise<ChatMessage[]> {
  const resolvedToken = token ?? (await getToken());
  const res = await safeFetch(`${STUDENT_API_URL}/chat/${assignmentId}/${problemNum}`, {
    headers: authHeaders(resolvedToken),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to fetch chat history'));
  const body = await res.json();
  return body.messages ?? [];
}
