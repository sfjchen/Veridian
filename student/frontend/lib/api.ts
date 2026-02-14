const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');

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
  hint_level: 'minimal' | 'guided' | 'detailed';
  reveal_mode: 'single-tap' | 'progressive';
  auto_analyze: boolean;
  analysis_debounce_seconds: number;
  notification_level: 'passive' | 'nudge' | 'interrupt';
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
  dot: MistakeDot;
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
  const res = await fetch(`${BASE_URL}/classrooms`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch classrooms (${res.status})`);
  }
  const data = await res.json();
  const list = data.classrooms ?? data;
  return Array.isArray(list) ? list : [];
}

export async function fetchAssignments(
  classroomId: string,
  token?: string,
): Promise<AssignmentListItem[]> {
  const res = await fetch(`${BASE_URL}/classrooms/${classroomId}/assignments`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch assignments (${res.status})`);
  }
  const data = await res.json();
  const list = data.assignments ?? data;
  return Array.isArray(list) ? list : [];
}

export async function fetchAssignment(assignmentId: string): Promise<Assignment> {
  const res = await fetch(`${BASE_URL}/assignments/${assignmentId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch assignment (${res.status})`);
  }
  const data = await res.json();
  return data.assignment;
}

export async function sendChatMessage(
  assignmentId: string,
  problemNum: number,
  message: string,
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ assignment_id: assignmentId, problem_num: problemNum, message }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Chat failed (${res.status})`);
  return body;
}

export async function fetchChatHistory(
  assignmentId: string,
  problemNum: number,
): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE_URL}/chat/${assignmentId}/${problemNum}`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Failed to fetch chat history (${res.status})`);
  return body.messages ?? [];
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
  opts: { assignmentId?: string; problemNum?: number; isSample?: boolean },
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

  const res = await fetch(`${BASE_URL}/analyze-solution`, {
    method: 'POST',
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Analysis failed (${res.status})`);
  return body;
}
