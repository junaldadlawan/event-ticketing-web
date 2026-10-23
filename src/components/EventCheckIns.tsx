import { useState } from 'react';
import { Segmented } from './Segmented';
import { eventApi } from '../api/endpoints';
import type { CheckInFilter } from '../api/endpoints';
import type { CheckInHistoryItem } from '../api/types';
import { useDebounced } from '../pages/admin/AdminTabs';
import { formatDateTime } from '../utils/format';
import { csvRow, downloadText } from '../utils/statement';
import { useAsync } from '../utils/useAsync';
import { Empty, ErrorBox, Pagination, Spinner } from './ui';

const RESULT_LABEL: Record<CheckInHistoryItem['result'], string> = {
  VALID: 'Valid',
  DUPLICATE: 'Duplicate',
  INVALID: 'Invalid',
  WRONG_EVENT: 'Wrong event',
};

const PAGE_SIZE = 25;
/** The most the API returns per page; the CSV is read in pages of this size. */
const EXPORT_SIZE = 100;

const scannerOf = (r: CheckInHistoryItem) => r.scannerName ?? 'Offline upload';

/**
 * The door's scan history for an event, read-only (owner, organizer, check-in staff, admin): stats, then every scan attempt
 * (newest first) with filters by online / offline, scanner, result and ticket number, and a CSV of what the filters match.
 * The stats, the list and the CSV all come from the API's scan history, which has scan facts only (no buyer details).
 */
export function EventCheckIns({ eventId, timezone }: { eventId: string; timezone: string }) {
  const [mode, setMode] = useState<'all' | 'online' | 'offline'>('all');
  const [scanner, setScanner] = useState('');
  const [result, setResult] = useState<CheckInHistoryItem['result'] | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const ticketNumber = useDebounced(search.trim());

  const filter: CheckInFilter = {
    sourceType: mode === 'online' ? 'SCANNER_DEVICE' : mode === 'offline' ? 'RECONCILED_FALLBACK' : undefined,
    scannerDeviceId: scanner || undefined,
    result: result || undefined,
    ticketNumber: ticketNumber || undefined,
  };
  const key = JSON.stringify(filter);

  const devices = useAsync(() => eventApi.scannerDevices(eventId), [eventId]);
  const summary = useAsync(() => eventApi.checkInSummary(eventId, filter), [eventId, key]);
  const history = useAsync(() => eventApi.checkInRecords(eventId, { ...filter, page, size: PAGE_SIZE }), [eventId, key, page]);

  function change(apply: () => void) {
    apply();
    setPage(0);
  }

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      const rows: CheckInHistoryItem[] = [];
      for (let p = 0; ; p++) {
        const chunk = await eventApi.checkInRecords(eventId, { ...filter, page: p, size: EXPORT_SIZE });
        rows.push(...chunk.content);
        if (chunk.last || chunk.content.length === 0) break;
      }
      const lines = [
        csvRow('Ticket number', 'Ticket type', 'Scanned at', 'Result', 'Online / offline', 'Scanner', 'Location'),
        ...rows.map((r) =>
          csvRow(
            r.ticketNumber ?? '',
            r.ticketTypeName ?? '',
            r.scannedAt,
            RESULT_LABEL[r.result],
            r.sourceType === 'RECONCILED_FALLBACK' ? 'Offline' : 'Online',
            scannerOf(r),
            r.scannerLocation ?? '',
          ),
        ),
      ];
      downloadText(`check-ins-${eventId.slice(0, 8)}.csv`, lines.join('\r\n'));
    } catch {
      setExportError('Could not download the scans. Try again.');
    } finally {
      setExporting(false);
    }
  }

  const s = summary.data;
  const filtered = Boolean(mode !== 'all' || scanner || result || ticketNumber);
  const rows = history.data?.content ?? [];

  return (
    <>
      <div className="org-stats checkin-stats">
        <Stat label="Total scans" value={s?.total} hint="every attempt" />
        <Stat label="Valid" value={s?.valid} hint={s ? `${s.uniqueTicketsAdmitted} of ${s.ticketsAdmittable} tickets in` : ' '} />
        <Stat label="Duplicate" value={s?.duplicate} hint="already used" />
        <Stat label="Invalid" value={s ? s.invalid + s.wrongEvent : undefined} hint="not accepted" />
        <Stat label="Online" value={s?.online} hint="scanned live" />
        <Stat label="Offline" value={s?.offline} hint="uploaded later" />
      </div>

      <div className="ticket-filters checkin-filters">
        <input
          type="search"
          className="select-auto"
          placeholder="Search ticket number..."
          aria-label="Search ticket number"
          value={search}
          onChange={(e) => change(() => setSearch(e.target.value))}
        />
        <Segmented
          label="Scan type"
          value={mode}
          onChange={(m) => change(() => setMode(m))}
          options={[
            { value: 'all', label: 'All' },
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
          ]}
        />
        {devices.data && devices.data.length > 0 && (
          <select className="select-auto" aria-label="Scanner" value={scanner} onChange={(e) => change(() => setScanner(e.target.value))}>
            <option value="">All scanners</option>
            {devices.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.location ? ` · ${d.location}` : ''}
              </option>
            ))}
          </select>
        )}
        <select
          className="select-auto"
          aria-label="Result"
          value={result}
          onChange={(e) => change(() => setResult(e.target.value as CheckInHistoryItem['result'] | ''))}
        >
          <option value="">All results</option>
          {Object.entries(RESULT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm" onClick={() => void download()} disabled={exporting || rows.length === 0}>
          {exporting ? 'Preparing...' : 'Download CSV'}
        </button>
      </div>
      <ErrorBox message={summary.error ?? history.error ?? exportError} />

      <div className="checkin-body">
        {history.loading && !history.data ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No records found{filtered ? ' for this filter' : ''}.</Empty>
        ) : (
          <div className="checkin-table">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ticket</th>
                  <th>Scanned</th>
                  <th>Result</th>
                  <th>Scanner</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted">{page * PAGE_SIZE + i + 1}</td>
                    <td>
                      <code>{r.ticketNumber ?? '-'}</code> <span className="muted small">{r.ticketTypeName ?? ''}</span>
                    </td>
                    <td>{formatDateTime(r.scannedAt, timezone)}</td>
                    <td>{RESULT_LABEL[r.result]}</td>
                    <td>
                      {scannerOf(r)}{' '}
                      <span className="muted small">
                        {r.sourceType === 'RECONCILED_FALLBACK' ? 'Offline' : 'Online'}
                        {r.scannerLocation ? ` · ${r.scannerLocation}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history.data && <Pagination page={history.data} onChange={setPage} />}
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | undefined; hint: string }) {
  return (
    <div className="org-stat">
      <span className="org-stat-label">{label}</span>
      <strong className="org-stat-value">{value ?? '-'}</strong>
      <span className="org-stat-hint">{hint}</span>
    </div>
  );
}
