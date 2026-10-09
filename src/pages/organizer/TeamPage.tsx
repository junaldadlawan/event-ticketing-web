import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { organizationApi } from '../../api/endpoints';
import type { OrganizationRole, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { UserPicker } from '../../components/UserPicker';
import { Empty, ErrorBox, Spinner, SuccessBox } from '../../components/ui';
import { formatDateTime, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

const ASSIGNABLE: OrganizationRole[] = ['ORGANIZER', 'CHECK_IN_STAFF'];

/** Team tab for an organization's owner and organizers: who is a member and with which role; the owner adds people. */
export function TeamPage() {
  const { user } = useAuth();
  const orgs = useAsync(
    async () => (await organizationApi.mine()).filter((o) => o.status === 'APPROVED' || o.status === 'SUSPENDED'),
    [],
  );
  const [orgId, setOrgId] = useState('');
  const selected = orgId || orgs.data?.[0]?.id || '';
  const members = useAsync(
    () => (selected ? organizationApi.members(selected) : Promise.resolve([])),
    [selected],
  );
  const [picked, setPicked] = useState<User | null>(null);
  const [role, setRole] = useState<OrganizationRole>('ORGANIZER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const org = orgs.data?.find((o) => o.id === selected);
  const list = members.data ?? [];
  // Only the owner may add people (the API refuses organizers); an organizer sees the team read-only.
  const isOwner = list.some((m) => m.userId === user?.id && m.roles.includes('OWNER'));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await organizationApi.assignMember(selected, picked.id, role);
      setMsg(`Added as ${humanize(role)}.`);
      setPicked(null);
      members.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (orgs.loading && !orgs.data) return <Spinner />;
  if (orgs.error) return <ErrorBox message={orgs.error} />;
  if (!orgs.data || orgs.data.length === 0) return <Empty>You don&apos;t have an organization yet.</Empty>;

  return (
    <>
      <h1>Team</h1>
      <p className="muted">
        The people who run {org?.name ?? 'your organization'}: the owner, organizers and check-in staff.
      </p>

      {orgs.data.length > 1 && (
        <div className="admin-toolbar">
          <select
            value={selected}
            onChange={(e) => {
              setOrgId(e.target.value);
              setPicked(null);
            }}
            aria-label="Organization"
          >
            {orgs.data.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <ErrorBox message={members.error ?? error} />
      <SuccessBox message={msg} />
      {members.loading && !members.data ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty>No members yet.</Empty>
      ) : (
        <ul className="plain-list">
          {list.map((m) => {
            const isMe = m.userId === user?.id;
            const name = m.name ?? (isMe ? user?.name : null) ?? `Member ${m.userId.slice(0, 8)}`;
            return (
              <li key={m.userId} className="row-between admin-member">
                <span className="admin-person">
                  <Avatar src={m.avatarUrl ?? (isMe ? user?.avatarUrl : null)} name={name} size={32} />
                  <span>
                    <strong>{name}</strong>
                    {isMe && <span className="muted small"> (you)</span>}
                    <span className="muted small admin-block">
                      {m.email ?? (isMe ? user?.email : null) ?? `ID ${m.userId.slice(0, 8)}…`} · since{' '}
                      {formatDateTime(m.assignedAt)}
                    </span>
                  </span>
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

      <h2 className="admin-section">Add a member</h2>
      {isOwner ? (
        <>
          <form className="admin-add-member" onSubmit={add}>
            <UserPicker users={[]} value={picked} onChange={setPicked} excludeIds={list.map((m) => m.userId)} onError={setError} />
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
          <small className="muted">
            Ask the person to open their profile and show you their My QR code (or send you the picture), then scan it
            here. The owner role can&apos;t be assigned.
          </small>
        </>
      ) : (
        <p className="muted small">Only the owner of {org?.name ?? 'the organization'} can add members.</p>
      )}
    </>
  );
}
