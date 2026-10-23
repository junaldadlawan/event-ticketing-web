import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../auth/roles';
import { scannerAppApi } from '../../api/endpoints';
import type { ScannerApp } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, ErrorBox, PageHeader, Spinner, SuccessBox } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { formatBytes, saveScannerApp } from '../../utils/scannerApp';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

/** Admin tab: upload a new version of the scanner Android app (APK) and see every upload so far. */
export function AdminScannerPage() {
  return (
    <AdminOnly>
      <PageHeader title="Scanner app" lede="The Android app door staff use to scan tickets. Check-in staff download the newest version." />
      <ScannerUploads />
    </AdminOnly>
  );
}

/**
 * The upload form and the history of uploads. For an admin, or a member holding SCANNER_APP (the API decides). The app is
 * shared by every organization; a version can only be removed by whoever uploaded it, or an admin.
 */
export function ScannerUploads() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => scannerAppApi.list(), []);
  const [file, setFile] = useState<File | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ScannerApp | null>(null);
  // Bumps to give the file input a fresh, empty state after an upload.
  const [formKey, setFormKey] = useState(0);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const app = await scannerAppApi.upload(file, versionName.trim(), Number(versionCode), notes.trim());
      setMsg(`Version ${app.versionName} uploaded.`);
      setFile(null);
      setVersionName('');
      setVersionCode('');
      setNotes('');
      setFormKey((k) => k + 1);
      reload();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove(app: ScannerApp) {
    setRemoving(null);
    setErr(null);
    setMsg(null);
    try {
      await scannerAppApi.remove(app.id);
      setMsg(`Version ${app.versionName} removed.`);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function download(app: ScannerApp) {
    setErr(null);
    try {
      await saveScannerApp(app);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <>
      <ErrorBox message={error ?? err} />
      <SuccessBox message={msg} />

      <form className="form scanner-upload" key={formKey} onSubmit={upload}>
        <h2>Upload a new version</h2>
        <p className="muted small">Every organization shares this app: the version you upload is the one all check-in staff download.</p>
        <label>
          APK file
          <input type="file" accept=".apk,application/vnd.android.package-archive" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="row">
          <label>
            Version name
            <input
              required
              maxLength={50}
              pattern="[A-Za-z0-9][A-Za-z0-9._+\-]*"
              placeholder="1.4.2"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
            />
          </label>
          <label>
            Version code
            <input
              required
              type="number"
              min={1}
              step={1}
              placeholder="42"
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
            />
          </label>
        </div>
        <label>
          Release notes (optional)
          <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className="muted small">The newest version is the one with the highest version code, and each code can be uploaded once.</p>
        <button className="btn btn-primary" disabled={busy || !file}>
          {busy ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      <h2>Uploads</h2>
      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <Empty>Nothing uploaded yet.</Empty>
      ) : (
        <div className="checkin-table">
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Build</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{a.versionName}</td>
                  <td>{a.versionCode}</td>
                  <td>{formatBytes(a.size)}</td>
                  <td>{formatDateTime(a.uploadedAt)}</td>
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => void download(a)}>
                      Download
                    </button>{' '}
                    {(isAdmin(user?.role) || a.uploadedBy === user?.id) && (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setRemoving(a)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this upload?"
        confirmLabel="Remove"
        danger
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      >
        {removing && <>Version {removing.versionName} can no longer be downloaded. It stays in the history.</>}
      </ConfirmDialog>
    </>
  );
}
