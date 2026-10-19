import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { disputeApi } from '../../api/endpoints';
import type { Dispute, DisputeStatus } from '../../api/types';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, Pagination, Spinner, SuccessBox, PageHeader } from '../../components/ui';
import { formatDateTime, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

const TONE: Record<DisputeStatus, string> = {
  OPEN: 'status-warn',
  INVESTIGATING: 'status-info',
  RESOLVED: 'status-good',
  DISMISSED: 'status-bad',
};
const isTerminal = (s: DisputeStatus) => s === 'RESOLVED' || s === 'DISMISSED';
const short = (id: string | null) => (id ? id.slice(0, 8) : '—');

/** Admin tab: disputes raised against orders and tickets. An admin moves each one to investigating, resolved or dismissed. */
export function AdminDisputesPage() {
  return (
    <AdminOnly>
      <DisputesManager />
    </AdminOnly>
  );
}

function DisputesManager() {
  const [status, setStatus] = useState<DisputeStatus | ''>('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Dispute | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const list = useAsync(() => disputeApi.list({ status: status || undefined, page, size: 20 }), [status, page]);
  const rows = list.data?.content ?? [];

  return (
    <>
      <PageHeader title="Disputes" lede="Problems customers reported with an order or ticket. Review each one and record the outcome." />
      <div className="admin-toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as DisputeStatus | '');
            setPage(0);
          }}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </div>
      <SuccessBox message={msg} />
      <ErrorBox message={list.error} />
      {list.loading && !list.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty>No disputes{status ? ` that are ${humanize(status).toLowerCase()}` : ''}.</Empty>
      ) : (
        <>
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Reported</th>
                <th>Reason</th>
                <th>Order</th>
                <th>Ticket</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="small">{formatDateTime(d.createdAt)}</td>
                  <td>{d.reason}</td>
                  <td className="small" title={d.orderId ?? undefined}>
                    {short(d.orderId)}
                  </td>
                  <td className="small" title={d.ticketId ?? undefined}>
                    {short(d.ticketId)}
                  </td>
                  <td>
                    <span className={`status-chip ${TONE[d.status]}`}>{humanize(d.status)}</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => setOpen(d)}>
                      {isTerminal(d.status) ? 'View' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data && <Pagination page={list.data} onChange={setPage} />}
        </>
      )}
      <FormDialog open={!!open} title="Dispute" onClose={() => setOpen(null)}>
        {open && (
          <ReviewForm
            dispute={open}
            onCancel={() => setOpen(null)}
            onSaved={() => {
              setOpen(null);
              setMsg('Dispute updated.');
              list.reload();
            }}
          />
        )}
      </FormDialog>
    </>
  );
}

/** Read the report, then pick the new status and write the outcome. Resolved and dismissed disputes are final, so they only show. */
function ReviewForm({ dispute, onCancel, onSaved }: { dispute: Dispute; onCancel: () => void; onSaved: () => void }) {
  const final = isTerminal(dispute.status);
  const [status, setStatus] = useState<DisputeStatus>(dispute.status);
  const [resolution, setResolution] = useState(dispute.resolution ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isTerminal(status) && !resolution.trim()) return setError('Write the outcome before closing the dispute.');
    setBusy(true);
    try {
      await disputeApi.update(dispute.id, { status, resolution: resolution.trim() || undefined });
      onSaved();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="small muted">Reported {formatDateTime(dispute.createdAt)}</p>
      <p>{dispute.reason}</p>
      <p className="small muted">
        Order {short(dispute.orderId)} · Ticket {short(dispute.ticketId)}
      </p>
      {final ? (
        <>
          <p>
            <span className={`status-chip ${TONE[dispute.status]}`}>{humanize(dispute.status)}</span>
          </p>
          <p>{dispute.resolution || 'No outcome was written.'}</p>
        </>
      ) : (
        <>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as DisputeStatus)}>
              {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Outcome <span className="muted">(required to resolve or dismiss; the customer is told)</span>
            <textarea rows={4} maxLength={1000} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </label>
          {isTerminal(status) && <p className="small muted">Resolved and dismissed disputes cannot be changed afterwards.</p>}
        </>
      )}
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          {final ? 'Close' : 'Cancel'}
        </button>
        {!final && (
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}
