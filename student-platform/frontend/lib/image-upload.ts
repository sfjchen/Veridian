import { Platform } from 'react-native';

/** Build FormData with image for analyze-solution. On web, uri (data:/blob:) must be converted to Blob. */
export async function buildAnalysisFormData(
  uri: string,
  extra: Record<string, string> = {}
): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await uriToBlob(uri);
    formData.append('image', blob, 'screenshot.png');
  } else {
    formData.append('image', { uri, name: 'screenshot.png', type: 'image/png' } as unknown as Blob);
  }
  Object.entries(extra).forEach(([k, v]) => formData.append(k, v));
  return formData;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return res.blob();
}
