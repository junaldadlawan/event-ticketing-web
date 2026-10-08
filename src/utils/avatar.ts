import { useEffect, useState } from 'react';

// Profile picture, kept in this browser only (localStorage) until the API can store one.
const key = (userId: string) => `avatar:${userId}`;
const EVENT = 'avatar-changed';
const SIZE = 256;

export function loadAvatar(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function removeAvatar(userId: string) {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* blocked storage */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Crops the picked image to a centred square, shrinks it to 256px and saves it as a small JPEG. */
export async function saveAvatar(userId: string, file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  try {
    localStorage.setItem(key(userId), canvas.toDataURL('image/jpeg', 0.85));
  } catch {
    throw new Error('Could not save the picture in this browser.');
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The user's picture (or null), kept in sync when it changes anywhere in the app. */
export function useAvatar(userId: string | undefined): string | null {
  const [src, setSrc] = useState<string | null>(() => (userId ? loadAvatar(userId) : null));
  useEffect(() => {
    const sync = () => setSrc(userId ? loadAvatar(userId) : null);
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [userId]);
  return src;
}
