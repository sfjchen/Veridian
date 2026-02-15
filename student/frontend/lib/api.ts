import type { ResolvedConfig } from '@/lib/teacherConfig';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');

/** Wraps fetch to surface network/CORS errors with a helpful message instead of raw TypeError. */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        `Network error: unable to reach the server. Check your connection and that the backend is running.`,
      );
    }
    throw e;
  }
}

/** Reads a JSON error body from a failed response, falling back to a generic message. */
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Prefer passing the logged-in user's token (e.g. from Supabase session) when available; env token is for dev/sample. */
export function getAuthHeaders(accessToken?: string): Record<string, string> {
  const token = accessToken ?? process.env.EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN?.trim();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export type Classroom = {
  id: string;
  name: string;
  class_code: string;
  created_at?: string;
};

export type AssignmentListItem = {
  id: string;
  title: string;
  due_date: string | null;
  classroom_id: string;
  created_at?: string;
};

export type Problem = {
  num: number;
  statement_tex: string;
};

export type Assignment = {
  id: string;
  title: string;
  problems: Problem[];
  auto_analyze?: boolean;
  analysis_debounce_seconds?: number;
  reveal_mode?: 'single-tap' | 'progressive';
  resolved_config?: Partial<ResolvedConfig>;
  assignment_file_download_url?: string | null;
};

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

export async function fetchClassrooms(token?: string): Promise<Classroom[]> {
  const res = await safeFetch(`${BASE_URL}/classrooms`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Failed to fetch classrooms (${res.status})`));
  }
  const data = await res.json();
  const list = data.classrooms ?? data;
  return Array.isArray(list) ? list : [];
}

export async function fetchAssignments(
  classroomId: string,
  token?: string,
): Promise<AssignmentListItem[]> {
  const res = await safeFetch(`${BASE_URL}/classrooms/${classroomId}/assignments`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Failed to fetch assignments (${res.status})`));
  }
  const data = await res.json();
  const list = data.assignments ?? data;
  return Array.isArray(list) ? list : [];
}

export async function fetchAssignment(assignmentId: string, token?: string): Promise<Assignment> {
  const res = await safeFetch(`${BASE_URL}/assignments/${assignmentId}`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Failed to fetch assignment (${res.status})`));
  }
  const data = await res.json();
  return data.assignment;
}

export async function sendChatMessage(
  assignmentId: string,
  problemNum: number,
  message: string,
  token?: string,
): Promise<ChatResponse> {
  const res = await safeFetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
    body: JSON.stringify({ assignment_id: assignmentId, problem_num: problemNum, message }),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Chat failed (${res.status})`));
  }
  return await res.json();
}

export async function fetchChatHistory(
  assignmentId: string,
  problemNum: number,
  token?: string,
): Promise<ChatMessage[]> {
  const res = await safeFetch(`${BASE_URL}/chat/${assignmentId}/${problemNum}`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Failed to fetch chat history (${res.status})`));
  }
  const body = await res.json();
  return body.messages ?? [];
}

export async function joinClassroom(classCode: string, token?: string): Promise<Classroom> {
  const res = await safeFetch(`${BASE_URL}/classrooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
    body: JSON.stringify({ class_code: classCode }),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Failed to join classroom (${res.status})`));
  }
  const body = await res.json();
  return body.classroom;
}

export type SubmitResult = { success: boolean; submission_id: string };

export async function submitAssignment(assignmentId: string, token?: string): Promise<SubmitResult> {
  const res = await safeFetch(`${BASE_URL}/assignments/${assignmentId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Failed to submit assignment (${res.status})`));
  }
  return await res.json();
}

export type AutocompleteResult = { suggestion: string; ms: number };

export async function fetchAutocomplete(
  canvasImage: string,
  problemContext: string,
  signal?: AbortSignal,
): Promise<AutocompleteResult> {
  const res = await safeFetch(`${BASE_URL}/handwriting-ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: canvasImage, problem_context: problemContext }),
    signal,
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Autocomplete failed (${res.status})`));
  }
  return await res.json();
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
  const formData = new FormData();

  if (imageUri.startsWith('data:')) {
    formData.append('image', dataUriToBlob(imageUri), 'screenshot.png');
  } else {
    // React Native's FormData.append() accepts {uri, name, type} objects.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const res = await safeFetch(`${BASE_URL}/analyze-solution`, {
    method: 'POST',
    headers: getAuthHeaders(opts.token),
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Analysis failed (${res.status})`));
  }
  return await res.json();
}
