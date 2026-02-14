import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

interface UploadOptions {
  uri: string;
  uploadUrl: string;
  mimeType: string;
  file?: File;
}

const isWeb = (Platform.OS as string) === "web";

export async function uploadFile({ uri, uploadUrl, mimeType, file }: UploadOptions): Promise<void> {
  if (isWeb) {
    if (!file) {
      throw new Error("File object required for web uploads");
    }
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": mimeType },
    });
    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  } else {
    const response = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": mimeType },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  }
}
