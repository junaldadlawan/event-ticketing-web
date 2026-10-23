import { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { scannerAppApi } from '../../api/endpoints';
import { useHasPermission } from '../../auth/useCanManage';
import { ScannerGuide } from '../../components/ScannerGuide';
import { ScannerUploads } from '../admin/AdminScannerPage';
import { ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { formatBytes, saveScannerApp } from '../../utils/scannerApp';
import { useAsync } from '../../utils/useAsync';

/**
 * Scanner tab: the newest version of the door-scanning Android app (uploaded by an admin) to download, and a guide to
 * installing and using it. Owners and organizers see the guide too, but the API only hands the app to check-in staff
 * and admins (403), so they get the placeholder.
 */
export function ScannerPage() {
  // A number is why there is no app: 404 nothing uploaded yet, 403 this account may not fetch it.
  const { data: app, error, loading } = useAsync(
    () =>
      scannerAppApi
        .latest()
        .catch((e) => (e instanceof ApiError && (e.status === 404 || e.status === 403) ? e.status : Promise.reject(e))),
    [],
  );
  // Members the owner allowed (and owners) can publish new versions; the API refuses anyone else.
  const canUpload = useHasPermission('SCANNER_APP', 'any');
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download() {
    if (typeof app !== 'object' || !app) return;
    setBusy(true);
    setDownloadError(null);
    try {
      await saveScannerApp(app);
    } catch (e) {
      setDownloadError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Check-in" lede="The app that scans tickets at the door." />
      <ErrorBox message={error ?? downloadError} />
      {loading && !app ? (
        <Spinner />
      ) : typeof app === 'object' && app ? (
        <section className="card scanner-app">
          <h2>Version {app.versionName}</h2>
          <p className="muted small">
            Build {app.versionCode} · {formatBytes(app.size)} · uploaded {formatDateTime(app.uploadedAt)}
          </p>
          {app.releaseNotes && <p className="scanner-app-notes">{app.releaseNotes}</p>}
          <button type="button" className="btn btn-primary" onClick={download} disabled={busy}>
            {busy ? 'Downloading...' : 'Download APK'}
          </button>
          <p className="muted small">
            SHA-256 <code>{app.sha256}</code>
          </p>
        </section>
      ) : app !== undefined && app !== null ? (
        <section className="card scanner-app scanner-app-placeholder" aria-label="Scanner app not available">
          <span className="scanner-app-tile" aria-hidden="true">
            APK
          </span>
          <div>
            <h2>The scanner app isn't available yet</h2>
            <p className="muted small">
              {app === 404
                ? 'No version has been uploaded yet. An admin uploads it from the Check-in tab, and it will show up here.'
                : "Your account can't download the app here. Ask an admin or a member of your check-in staff for the APK."}
            </p>
            <button type="button" className="btn btn-primary" disabled>
              Download APK
            </button>
          </div>
        </section>
      ) : null}
      {canUpload && <ScannerUploads />}
      <ScannerGuide />
    </>
  );
}
