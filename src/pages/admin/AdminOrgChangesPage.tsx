import { useState } from 'react';
import { Segmented } from '../../components/Segmented';
import { FormActions } from '../../components/Button';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { organizationApi } from '../../api/endpoints';
import type { OrganizationChangeRequest } from '../../api/types';
import { FormDialog } from '../../components/FormDialog';
import { OrgChangeLines } from '../../components/OrgChangeLines';
import { Empty, ErrorBox, PageHeader, Pagination, Spinner, SuccessBox } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';

type Status = OrganizationChangeRequest['status'];
const STATUSES: { value: Status; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** Admin: the changes organizations asked to make to their details, with the current values next to the requested ones. */
export function AdminOrgChangesPage() {
  return (
    <AdminOnly>
      <Requests />
    </AdminOnly>
  );
}

function Requests() {
  const [status, setStatus] = useState<Status>('PENDING');
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync(() => organizationApi.allChangeRequests({ status, page, size: 20 }), [status, page]);
  const [rejecting, setRejecting] = useState<OrganizationChangeRequest | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function approve(r: OrganizationChangeRequest) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await organizationApi.approveChange(r.id);
      setMsg(`Approved: ${r.organizationName} now has the new details.`);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await organizationApi.rejectChange(rejecting.id, reason.trim());
      setMsg(`Rejected the change for ${rejecting.organizationName}.`);
      setRejecting(null);
      setReason('');
      reload();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.content ?? [];

  return (
    <>
      <PageHeader
        title="Organization changes"
        lede="Organizations ask before changing their details. Approve to apply a change, or reject it with a reason."
        actions={
          <Link to="/admin/organizations" className="btn">
            Organizations
          </Link>
        }
      />
      <Segmented
        text
        label="Filter by status"
        value={status}
        options={STATUSES}
        onChange={(v) => {
          setStatus(v);
          setPage(0);
        }}
      />
      <ErrorBox message={error ?? err} />
      <SuccessBox message={msg} />
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty>No {status.toLowerCase()} changes.</Empty>
      ) : (
        <ul className="plain-list org-changes">
          {rows.map((r) => (
            <li key={r.id} className="card">
              <div className="row-between">
                <strong>{r.organizationName}</strong>
                <span className="muted small">Asked {formatDateTime(r.createdAt)}</span>
              </div>
              <OrgChangeLines request={r} />
              {r.status === 'PENDING' ? (
                <div className="modal-actions">
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setRejecting(r)}>
                    Reject
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void approve(r)}>
                    Approve
                  </button>
                </div>
              ) : (
                <p className="muted small">
                  {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} {r.decidedAt ? formatDateTime(r.decidedAt) : ''}
                  {r.rejectionReason ? `: ${r.rejectionReason}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data} onChange={setPage} />}

      <FormDialog open={rejecting !== null} title="Reject this change" onClose={() => setRejecting(null)}>
        <form className="form" onSubmit={reject}>
          <label>
            Reason <span className="hint">(the organization sees it)</span>
            <textarea required rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <FormActions onCancel={() => setRejecting(null)} busy={busy} busyLabel="Rejecting…" submitLabel="Reject change" submitDisabled={!reason.trim()} />
        </form>
      </FormDialog>
    </>
  );
}
