import { supabase, STORAGE_BUCKET } from './supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export async function uploadPhoto(
  localUri: string,
  folder: string
): Promise<string | null> {
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

  try {
    let body: Blob | ArrayBuffer;

    if (Platform.OS === 'web') {
      const response = await fetch(localUri);
      body = await response.blob();
    } else if (localUri.startsWith('data:')) {
      const base64 = localUri.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      body = bytes.buffer;
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      body = bytes.buffer;
    }

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, body, { contentType: 'image/jpeg' });

    if (error) throw error;
    return filePath;
  } catch (err) {
    console.error('Error uploading photo:', err);
    return null;
  }
}

export function getPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
