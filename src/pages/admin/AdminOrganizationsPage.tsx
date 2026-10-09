import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { adminUserApi, eventApi, moderationApi, organizationApi } from '../../api/endpoints';
import type { Organization, OrganizationRole, OrganizationStatus, User } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditIcon, SearchIcon, StatsIcon } from '../../components/DesignerIcons';
import { FormDialog } from '../../components/FormDialog';
import { UserPicker } from '../../components/UserPicker';
import { Empty, ErrorBox, Spinner, SuccessBox } from '../../components/ui';
import { formatDateTime, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';
import { OrgStats } from './OrgStats';
import { ReasonForm } from './ReasonForm';

/** What the list shows: the API status, except that an approved organization with events is "Active". */
type DisplayStatus = OrganizationStatus | 'OPERATING';
type StatusFilter = 'ALL' | DisplayStatus;

/** The word shown for an approved organization that has created events (one place to rename it, e.g. "Active"). */
const OPERATING_LABEL = 'Active';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'OPERATING', label: OPERATING_LABEL },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const TONE: Record<DisplayStatus, string> = {
  PENDING: 'status-warn',
  APPROVED: 'status-good',
  OPERATING: 'status-info',
  REJECTED: 'status-bad',
  SUSPENDED: 'status-bad',
};

/** What the status chip shows on hover: when the organization got into that state. */
function statusTooltip(o: Organization): string {
  const when = (iso?: string | null) => formatDateTime(iso ?? undefined);
  switch (o.status) {
    case 'PENDING':
      return `Applied ${when(o.createdAt)}`;
    case 'APPROVED':
      // Until the API records the approval time, the last change is the closest thing it has.
      return o.approvedAt ? `Approved ${when(o.approvedAt)}` : `Approved (last updated ${when(o.updatedAt ?? o.createdAt)})`;
    case 'REJECTED':
      return `Rejected ${when(o.updatedAt ?? o.createdAt)}`;
    case 'SUSPENDED':
      return `Suspended ${when(o.updatedAt ?? o.createdAt)}`;
  }
}

type Action =
  | { kind: 'approve'; org: Organization }
  | { kind: 'reject'; org: Organization }
  | { kind: 'suspend'; org: Organization }
  | { kind: 'reinstate'; org: Organization }
  | { kind: 'stats'; org: Organization }
  | { kind: 'rename'; org: Organization }
  | { kind: 'members'; org: Organization };

/** Admin tab: organizer applications and organizations - approve, reject, suspend, rename, and manage members. */
export function AdminOrganizationsPage() {
  return (
    <AdminOnly>
      <OrganizationsManager />
    </AdminOnly>
  );
}

function OrganizationsManager() {
  const orgs = useAsync(() => organizationApi.list(), []);
  const users = useAsync(() => adminUserApi.list(), []);
  // Which organizations have created at least one event (any state): those are "operating".
  const orgsWithEvents = useAsync(loadOrgIdsWithEvents, []);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const userById = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u])), [users.data]);
  const displayStatus = (o: Organization): DisplayStatus =>
    o.status === 'APPROVED' && orgsWithEvents.data?.has(o.id) ? 'OPERATING' : o.status;
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orgs.data?.length ?? 0 };
    for (const o of orgs.data ?? []) {
      const d = displayStatus(o);
      c[d] = (c[d] ?? 0) + 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs.data, orgsWithEvents.data]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orgs.data ?? [])
      .filter((o) => filter === 'ALL' || displayStatus(o) === filter)
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs.data, orgsWithEvents.data, filter, query]);

  function done(message: string) {
    setAction(null);
    setErr(null);
    setMsg(message);
    orgs.reload();
  }

  async function runApprove() {
    const a = action;
    setAction(null);
    if (a?.kind !== 'approve') return;
    setErr(null);
    setMsg(null);
    try {
      await organizationApi.approve(a.org.id);
      done(`${a.org.name} was approved.`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const owner = (o: Organization) => (o.ownerId ? userById.get(o.ownerId) : undefined);

  return (
    <>
      <h1>Organizations</h1>
      <p className="muted">Review organizer applications, and manage the organizations that host events.</p>

      <div className="admin-toolbar">
        <label className="admin-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search organizations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search organizations"
          />
        </label>
        <div className="segmented segmented-text" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {counts[f.value] ? <span className="seg-count">{counts[f.value]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <ErrorBox message={orgs.error ?? err} />
      <SuccessBox message={msg} />
      {orgs.loading && !orgs.data ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty>No organizations match.</Empty>
      ) : (
        <ul className="plain-list">
          {list.map((o) => {
            const own = owner(o);
            return (
              <li key={o.id} className="admin-card">
                <div className="row-between">
                  <div className="admin-org-main">
                    <div className="admin-org-title">
                      <strong>{o.name}</strong>
                      <span className={`status-chip ${TONE[displayStatus(o)]}`} title={statusTooltip(o)}>
                        {displayStatus(o) === 'OPERATING' ? OPERATING_LABEL : humanize(o.status)}
                      </span>
                    </div>
                    <div className="muted small">
                      {own ? `${own.name} (${own.email})` : o.ownerId ? 'Owner not found' : 'No owner yet'} · applied{' '}
                      {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title="Statistics"
                      aria-label={`Statistics for ${o.name}`}
                      onClick={() => setAction({ kind: 'stats', org: o })}
                    >
                      <StatsIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Rename"
                      aria-label={`Rename ${o.name}`}
                      onClick={() => setAction({ kind: 'rename', org: o })}
                    >
                      <EditIcon />
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setAction({ kind: 'members', org: o })}>
                      Members
                    </button>
                    {o.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => setAction({ kind: 'approve', org: o })}
                        >
                          Approve
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setAction({ kind: 'reject', org: o })}>
                          Reject
                        </button>
                      </>
                    )}
                    {/* an operating organization is an approved one: it can be suspended too */}
                    {o.status === 'APPROVED' && (
                      <button type="button" className="btn btn-sm" onClick={() => setAction({ kind: 'suspend', org: o })}>
                        Suspend
                      </button>
                    )}
                    {o.status === 'SUSPENDED' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setAction({ kind: 'reinstate', org: o })}
                      >
                        Reinstate
                      </button>
                    )}
                  </div>
                </div>
                {o.status === 'REJECTED' && o.rejectionReason && (
                  <p className="small muted">Rejected: {o.rejectionReason}</p>
                )}
                {o.documents.length > 0 && (
                  <p className="small">
                    <span className="muted">Documents: </span>
                    {o.documents.map((d, i) => (
                      <span key={`${d.url}-${i}`}>
                        {i > 0 && ', '}
                        <a href={d.url} target="_blank" rel="noreferrer">
                          {d.type}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={action?.kind === 'approve'}
        title={`Approve ${action?.org.name ?? 'this organization'}?`}
        confirmLabel="Approve"
        cancelLabel="Cancel"
        onCancel={() => setAction(null)}
        onConfirm={() => void runApprove()}
      >
        The applicant becomes the organization&apos;s owner and can create and publish events.
      </ConfirmDialog>

      <FormDialog open={action?.kind === 'reject'} title="Reject application" onClose={() => setAction(null)}>
        {action?.kind === 'reject' && (
          <ReasonForm
            intro={`${action.org.name} will be told the application was rejected.`}
            confirmLabel="Reject"
            danger
            optional
            onCancel={() => setAction(null)}
            onSubmit={async (reason) => {
              await organizationApi.reject(action.org.id, reason || undefined);
              done(`${action.org.name} was rejected.`);
            }}
          />
        )}
      </FormDialog>

      <FormDialog
        open={action?.kind === 'suspend' || action?.kind === 'reinstate'}
        title={action?.kind === 'reinstate' ? 'Reinstate organization' : 'Suspend organization'}
        onClose={() => setAction(null)}
      >
        {(action?.kind === 'suspend' || action?.kind === 'reinstate') && (
          <ReasonForm
            intro={
              action.kind === 'suspend'
                ? `${action.org.name} can't create or publish events until you reinstate it. Its owner and members are told.`
                : `${action.org.name} goes back to how it was before it was suspended.`
            }
            confirmLabel={action.kind === 'suspend' ? 'Suspend' : 'Reinstate'}
            danger={action.kind === 'suspend'}
            onCancel={() => setAction(null)}
            onSubmit={async (reason) => {
              await moderationApi.create({
                targetType: 'ORGANIZATION',
                targetId: action.org.id,
                action: action.kind === 'suspend' ? 'SUSPEND' : 'REINSTATE',
                reason,
              });
              done(action.kind === 'suspend' ? `${action.org.name} was suspended.` : `${action.org.name} was reinstated.`);
            }}
          />
        )}
      </FormDialog>

      <FormDialog
        open={action?.kind === 'stats'}
        title={action?.kind === 'stats' ? `${action.org.name}: statistics` : 'Statistics'}
        onClose={() => setAction(null)}
      >
        {action?.kind === 'stats' && (
          <>
            <OrgStats org={action.org} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setAction(null)}>
                Close
              </button>
            </div>
          </>
        )}
      </FormDialog>

      <FormDialog open={action?.kind === 'rename'} title="Rename organization" onClose={() => setAction(null)}>
        {action?.kind === 'rename' && (
          <RenameForm org={action.org} onCancel={() => setAction(null)} onSaved={() => done('Organization renamed.')} />
        )}
      </FormDialog>

      <FormDialog
        open={action?.kind === 'members'}
        title={action?.kind === 'members' ? `Members of ${action.org.name}` : 'Members'}
        onClose={() => setAction(null)}
      >
        {action?.kind === 'members' && (
          <MembersPanel org={action.org} users={users.data ?? []} onClose={() => setAction(null)} />
        )}
      </FormDialog>
    </>
  );
}

function RenameForm({ org, onCancel, onSaved }: { org: Organization; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === org.name) {
      onCancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await organizationApi.rename(org.id, name.trim());
      onSaved();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Name
        <input required autoFocus maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

const ASSIGNABLE: OrganizationRole[] = ['ORGANIZER', 'CHECK_IN_STAFF'];

function MembersPanel({ org, users, onClose }: { org: Organization; users: User[]; onClose: () => void }) {
  const members = useAsync(() => organizationApi.members(org.id), [org.id]);
  const [picked, setPicked] = useState<User | null>(null);
  const [role, setRole] = useState<OrganizationRole>('ORGANIZER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await organizationApi.assignMember(org.id, picked.id, role);
      setPicked(null);
      members.reload();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      {members.loading && !members.data ? (
        <Spinner />
      ) : (members.data ?? []).length === 0 ? (
        <Empty>No members yet.</Empty>
      ) : (
        <ul className="plain-list">
          {(members.data ?? []).map((m) => {
            const u = userById.get(m.userId);
            return (
              <li key={m.userId} className="row-between admin-member">
                <span>
                  <strong>{u?.name ?? 'Unknown user'}</strong>
                  <span className="muted small"> {u?.email ?? m.userId}</span>
                </span>
                <span>
                  {m.roles.map((r) => (
                    <span key={r} className="status-chip status-info admin-chip">
                      {humanize(r)}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form className="admin-add-member" onSubmit={add}>
        <UserPicker
          users={users}
          value={picked}
          onChange={setPicked}
          excludeIds={(members.data ?? []).map((x) => x.userId)}
          onError={setError}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as OrganizationRole)} aria-label="Role">
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" disabled={!picked || busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      <small className="muted">The owner comes from approving the application, so it can&apos;t be assigned here.</small>
      <ErrorBox message={members.error ?? error} />
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/** Ids of the organizations that have at least one event. As an admin the managed list covers every organization. */
async function loadOrgIdsWithEvents(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let page = 0; page < 10; page++) {
    const res = await eventApi.managed({ page, size: 100, sort: 'createdAt,desc' });
    for (const e of res.content) ids.add(e.organizationId);
    if (res.last) break;
  }
  return ids;
}
