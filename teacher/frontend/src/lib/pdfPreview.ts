import { supabase } from "./supabase";
import { API_URL } from "./apiBaseUrl";

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF87A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const BMP_SIGNATURE = [0x42, 0x4d];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const GZIP_SIGNATURE = [0x1f, 0x8b, 0x08];
const SEVEN_Z_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];
const MP4_FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70];
const TEXT_MIME_HINTS = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-tex",
  "application/x-latex",
  "application/rtf",
];

interface PreviewPayload {
  mime_type: string;
  image_base64: string;
}

function hasSignature(bytes: Uint8Array, signature: number[], offset: number = 0): boolean {
  if (bytes.length < signature.length + offset) {
    return false;
  }
  return signature.every((byte, idx) => bytes[offset + idx] === byte);
}

function looksLikeKnownBinary(bytes: Uint8Array): boolean {
  if (hasSignature(bytes, ZIP_SIGNATURE) || hasSignature(bytes, GZIP_SIGNATURE)) {
    return true;
  }
  if (hasSignature(bytes, SEVEN_Z_SIGNATURE)) {
    return true;
  }
  return hasSignature(bytes, MP4_FTYP_SIGNATURE, 4);
}

export function looksLikePdf(contentType: string, bytes: Uint8Array): boolean {
  if (contentType.toLowerCase().includes("application/pdf")) {
    return true;
  }
  return hasSignature(bytes, PDF_SIGNATURE);
}

export function looksLikeImage(contentType: string, bytes: Uint8Array): boolean {
  if (contentType.toLowerCase().startsWith("image/")) {
    return true;
  }
  if (hasSignature(bytes, PNG_SIGNATURE) || hasSignature(bytes, JPEG_SIGNATURE)) {
    return true;
  }
  if (hasSignature(bytes, GIF87A_SIGNATURE) || hasSignature(bytes, GIF89A_SIGNATURE)) {
    return true;
  }
  if (hasSignature(bytes, BMP_SIGNATURE)) {
    return true;
  }
  return hasSignature(bytes, RIFF_SIGNATURE) && hasSignature(bytes, WEBP_SIGNATURE, 8);
}

export function looksLikeText(contentType: string, bytes: Uint8Array): boolean {
  const normalizedType = contentType.toLowerCase();

  if (
    looksLikePdf(normalizedType, bytes) ||
    looksLikeImage(normalizedType, bytes) ||
    looksLikeKnownBinary(bytes)
  ) {
    return false;
  }

  if (TEXT_MIME_HINTS.some((hint) => normalizedType.includes(hint))) {
    return true;
  }

  if (normalizedType && normalizedType !== "application/octet-stream") {
    return false;
  }

  if (bytes.length === 0) {
    return false;
  }

  const sample = bytes.slice(0, 512);
  let controlCount = 0;
  let highByteCount = 0;
  for (const byte of sample) {
    if (byte === 0) {
      return false;
    }
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      controlCount += 1;
    }
    if (byte >= 0x80) {
      highByteCount += 1;
    }
  }
  return controlCount / sample.length < 0.05 && highByteCount / sample.length < 0.25;
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
