import { supabase } from "./supabase";
import { API_URL } from "./apiBaseUrl";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: Record<string, unknown>;
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

async function apiRequest<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch" || msg.includes("Network request failed") || msg.includes("Load failed")) {
      throw new Error("Can't reach server. Start the teacher backend.");
    }
    throw e;
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Non-JSON response body, fall back to HTTP status.
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T;
  }

  try {
    return await response.json();
  } catch {
    throw new Error("Invalid response from server");
  }
}

type ApiClient = (<T = unknown>(path: string, options?: ApiOptions) => Promise<T>) & {
  baseUrl: string;
  getToken: () => Promise<string | null>;
};

export const api: ApiClient = Object.assign(apiRequest, {
  baseUrl: API_URL,
  getToken,
});
