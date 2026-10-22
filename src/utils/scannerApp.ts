import { scannerAppApi } from '../api/endpoints';
import type { ScannerApp } from '../api/types';

/** "12.4 MB" for a size in bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Fetches the APK (it needs the login) and hands it to the browser as a file download. */
export async function saveScannerApp(app: ScannerApp) {
  const url = URL.createObjectURL(await scannerAppApi.download(app.id));
  const a = document.createElement('a');
  a.href = url;
  a.download = `scanner-${app.versionName}.apk`;
  a.click();
  URL.revokeObjectURL(url);
}
