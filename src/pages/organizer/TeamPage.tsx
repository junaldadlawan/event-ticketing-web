import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { organizationApi } from '../../api/endpoints';
import type { OrganizationMember, OrganizationRole, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditIcon } from '../../components/DesignerIcons';
import { FormDialog } from '../../components/FormDialog';
import { UserPicker } from '../../components/UserPicker';
import { Empty, ErrorBox, Spinner, SuccessBox, PageHeader } from '../../components/ui';
import { LogsButton } from '../../components/LogsButton';
import { formatDateTime, fullName, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

const ASSIGNABLE: OrganizationRole[] = ['ORGANIZER', 'CHECK_IN_STAFF'];

/** Team tab for an organization's owner and organizers: who is a member and with which role; the owner adds, edits and removes people. */
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
  // The member being edited, with the roles ticked in the dialog.
  const [editing, setEditing] = useState<OrganizationMember | null>(null);
  const [editRoles, setEditRoles] = useState<OrganizationRole[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);

  const org = orgs.data?.find((o) => o.id === selected);
  const list = members.data ?? [];
  // Only the owner may add, edit or remove people (the API refuses organizers); an organizer sees the team read-only.
  const isOwner = list.some((m) => m.userId === user?.id && m.roles.includes('OWNER'));
  const nameOf = (m: OrganizationMember) =>
    m.name ?? (m.userId === user?.id && user ? fullName(user) : null) ?? `Member ${m.userId.slice(0, 8)}`;

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

  function startEdit(m: OrganizationMember) {
    setEditing(m);
    setEditRoles(m.roles.filter((r) => ASSIGNABLE.includes(r)));
    setEditError(null);
  }

  async function saveRoles(e: FormEvent) {
    e.preventDefault();
    if (!editing || editRoles.length === 0) return;
    setBusy(true);
    setEditError(null);
    setMsg(null);
    try {
      await organizationApi.setMemberRoles(selected, editing.userId, editRoles);
      setMsg(`${nameOf(editing)} is now ${editRoles.map(humanize).join(' and ')}.`);
      setEditing(null);
      members.reload();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const m = removing;
    setRemoving(null);
    if (!m) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await organizationApi.removeMember(selected, m.userId);
      setMsg(`${nameOf(m)} was removed from the team.`);
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
      <PageHeader
        title="Team"
        lede={<>The people who run {org?.name ?? 'your organization'}: the owner, organizers and check-in staff.</>}
        actions={org && <LogsButton area="TEAM" title="Team" organizations={[{ id: org.id, name: org.name }]} />}
      />

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
            const name = nameOf(m);
            return (
              <li key={m.userId} className="row-between admin-member">
                <span className="admin-person">
                  <Avatar src={m.avatarUrl ?? (isMe ? user?.avatarUrl : null)} name={name} size={32} />
                  <span>
                    <strong>{name}</strong>
                    {isMe && <span className="muted small"> (you)</span>}
                    <span className="muted small admin-block">
                      {m.email ?? (isMe ? user?.email : null) ?? `ID ${m.userId.slice(0, 8)}…`}
                      {m.phoneNumber && <> · {m.phoneNumber}</>} · since {formatDateTime(m.assignedAt)}
                    </span>
                  </span>
                  {/* The owner's own membership can't be changed or removed (the API answers 409). */}
                  {isOwner && !m.roles.includes('OWNER') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-icon tt-edit team-edit"
                      disabled={busy}
                      onClick={() => startEdit(m)}
                      aria-label={`Edit ${name}`}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  )}
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
        <p className="muted small">Only the owner of {org?.name ?? 'the organization'} can add or change members.</p>
      )}

      <FormDialog open={editing !== null} title={editing ? `Edit ${nameOf(editing)}` : 'Edit member'} onClose={() => setEditing(null)}>
        <form className="form" onSubmit={saveRoles}>
          <p className="small muted">
            Their name, email and phone number belong to their own account, so only they can change them.
          </p>
          <fieldset>
            <legend>Roles</legend>
            {ASSIGNABLE.map((r) => (
              <label key={r} className="check-row">
                <input
                  type="checkbox"
                  checked={editRoles.includes(r)}
                  onChange={() => setEditRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))}
                />
                {humanize(r)}
              </label>
            ))}
          </fieldset>
          {editRoles.length === 0 && <p className="small muted">Pick at least one role, or remove them from the team.</p>}
          <ErrorBox message={editError} />
          <div className="modal-actions">
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() => {
                setRemoving(editing);
                setEditing(null);
              }}
            >
              Remove from team
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy || editRoles.length === 0}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Remove ${nameOf(removing)}?` : 'Remove member?'}
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      >
        They lose every role in {org?.name ?? 'the organization'}. Their past actions stay in the logs.
      </ConfirmDialog>
    </>
  );
}
