import { supabase } from "./supabase";
import { API_URL } from "./apiBaseUrl";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: Record<string, unknown>;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b95751e3-13de-4370-a43a-9eeabde26151',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:catch',message:'backend-down UX',data:{thrownMessage:"Can't reach server. Start the teacher backend."},timestamp:Date.now(),hypothesisId:'task4'})}).catch(()=>{});
      // #endregion
      throw new Error("Can't reach server. Start the teacher backend.");
    }
    throw e;
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) errorMessage = errorBody.error;
    } catch {
      // Non-JSON response body, fall back to HTTP status
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T;
  }

  return response.json();
}
