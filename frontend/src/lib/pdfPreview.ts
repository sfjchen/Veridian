import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:5000" : undefined);

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL must be set in production");
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

interface PreviewPayload {
  mime_type: string;
  image_base64: string;
}

export function looksLikePdf(contentType: string, bytes: Uint8Array): boolean {
  if (contentType.toLowerCase().includes("application/pdf")) {
    return true;
  }
  if (bytes.length < PDF_SIGNATURE.length) {
    return false;
  }
  return PDF_SIGNATURE.every((byte, idx) => bytes[idx] === byte);
}

export async function createPdfPreviewDataUri(pdfBlob: Blob): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append("file", pdfBlob as any, "assignment.pdf");

  const response = await fetch(`${API_URL}/convert/pdf-to-preview-image`, {
    method: "POST",
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
    body: formData,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      if (err?.error) message = err.error;
    } catch {
      // Ignore JSON parse failure and keep HTTP fallback message.
    }
    throw new Error(message);
  }

  const payload = await response.json() as PreviewPayload;
  if (!payload.image_base64) {
    throw new Error("Preview generation returned empty image data");
  }

  const mimeType = payload.mime_type || "image/png";
  return `data:${mimeType};base64,${payload.image_base64}`;
}
