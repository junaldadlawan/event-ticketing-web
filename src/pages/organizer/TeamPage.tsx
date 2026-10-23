import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { organizationApi } from '../../api/endpoints';
import type { OrganizationMember, OrganizationPermission, OrganizationRole, User } from '../../api/types';
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

/** What an organizer may do (BR-ORG-008), in the order the checkboxes show them. */
const PERMISSIONS: { value: OrganizationPermission; label: string; hint: string }[] = [
  { value: 'EVENTS', label: 'Events', hint: 'events, ticket types, seat maps, venues, ticket designs' },
  { value: 'PROMO_CODES', label: 'Promo codes', hint: 'create, edit, pause and delete codes' },
  { value: 'CHECK_IN', label: 'Check-in', hint: 'check-in settings and scanner devices' },
  { value: 'ORDERS_REFUNDS', label: 'Orders & refunds', hint: 'orders, refunds, refund and resale policies' },
  { value: 'FINANCE', label: 'Finance', hint: 'payout accounts, cards and payouts' },
  { value: 'ANALYTICS', label: 'Analytics', hint: 'sales and audience insights, activity logs' },
  { value: 'TEAM', label: 'Team', hint: 'add, change and remove members' },
  { value: 'SCANNER_APP', label: 'Scanner app', hint: 'upload and remove versions of the scanner app, which every organization shares' },
];
// The API's default for a new organizer: everything but TEAM and SCANNER_APP.
const DEFAULT_PERMISSIONS = PERMISSIONS.map((p) => p.value).filter((p) => p !== 'TEAM' && p !== 'SCANNER_APP');

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** The organizer permission checkboxes; one the caller doesn't hold can't be granted (the API answers 403). */
function PermissionChecks({
  value,
  onChange,
  held,
}: {
  value: OrganizationPermission[];
  onChange: (next: OrganizationPermission[]) => void;
  held: OrganizationPermission[];
}) {
  return (
    <div className="team-perms">
      {PERMISSIONS.map((p) => (
        <label key={p.value} className="check-row" title={held.includes(p.value) ? undefined : "You don't have this permission yourself"}>
          <input
            type="checkbox"
            checked={value.includes(p.value)}
            disabled={!held.includes(p.value)}
            onChange={() => onChange(toggle(value, p.value))}
          />
          <span>
            {p.label} <span className="muted small">· {p.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Team tab for an organization's owner and organizers: who is a member, with which role and permissions. */
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
  const [addPerms, setAddPerms] = useState<OrganizationPermission[]>(DEFAULT_PERMISSIONS);
  // Check-in staff can be allowed to publish the scanner app (the only permission they can hold).
  const [addScanner, setAddScanner] = useState(false);
  // The Add a member window.
  const [adding, setAdding] = useState(false);
  const [editScanner, setEditScanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // The member being edited, with the roles and permissions ticked in the dialog.
  const [editing, setEditing] = useState<OrganizationMember | null>(null);
  const [editRoles, setEditRoles] = useState<OrganizationRole[]>([]);
  const [editPerms, setEditPerms] = useState<OrganizationPermission[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);

  const org = orgs.data?.find((o) => o.id === selected);
  const list = members.data ?? [];
  const me = list.find((m) => m.userId === user?.id);
  // The owner holds every permission; an organizer holds the ones the owner gave them.
  const held = me?.roles.includes('OWNER') ? PERMISSIONS.map((p) => p.value) : (me?.permissions ?? []);
  // The owner, or an organizer with TEAM, may add, edit and remove people; anyone else sees the team read-only.
  const canManageTeam = held.includes('TEAM');
  const nameOf = (m: OrganizationMember) =>
    m.name ?? (m.userId === user?.id && user ? fullName(user) : null) ?? `Member ${m.userId.slice(0, 8)}`;
  const grantable = (perms: OrganizationPermission[]) => perms.filter((p) => held.includes(p));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await organizationApi.assignMember(
        selected,
        picked.id,
        role,
        role === 'ORGANIZER' ? addPerms : role === 'CHECK_IN_STAFF' && addScanner ? ['SCANNER_APP'] : undefined,
      );
      setMsg(`Added as ${humanize(role)}.`);
      setPicked(null);
      setAdding(false);
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
    setEditPerms(m.roles.includes('ORGANIZER') ? (m.permissions ?? []) : grantable(DEFAULT_PERMISSIONS));
    setEditScanner(Boolean(m.permissions?.includes('SCANNER_APP')));
    setEditError(null);
  }

  async function saveRoles(e: FormEvent) {
    e.preventDefault();
    if (!editing || editRoles.length === 0) return;
    setBusy(true);
    setEditError(null);
    setMsg(null);
    try {
      const organizer = editRoles.includes('ORGANIZER');
      // Staff without the organizer role keep only SCANNER_APP, which this sends explicitly (empty = take it away).
      const staffOnly = editRoles.includes('CHECK_IN_STAFF') && !organizer;
      await organizationApi.setMemberRoles(
        selected,
        editing.userId,
        editRoles,
        organizer ? editPerms : staffOnly ? (editScanner ? ['SCANNER_APP'] : []) : undefined,
      );
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
        actions={
          org && (
            <>
              <LogsButton area="TEAM" title="Team" organizations={[{ id: org.id, name: org.name }]} />
              {canManageTeam && (
                <button type="button" className="btn btn-cta" onClick={() => setAdding(true)}>
                  Add member
                </button>
              )}
            </>
          )
        }
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
            const perms = (m.roles.includes('ORGANIZER') || m.roles.includes('CHECK_IN_STAFF')) && !m.roles.includes('OWNER') ? (m.permissions ?? []) : [];
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
                    {perms.length > 0 && (
                      <span className="muted small admin-block">
                        Can manage: {PERMISSIONS.filter((p) => perms.includes(p.value)).map((p) => p.label).join(', ')}
                      </span>
                    )}
                  </span>
                  {/* The owner's membership and your own can't be changed or removed here (the API answers 409). */}
                  {canManageTeam && !isMe && !m.roles.includes('OWNER') && (
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

      {!canManageTeam && (
        <p className="muted small">
          Only the owner of {org?.name ?? 'the organization'}, or an organizer they allow to manage the team, can add or
          change members.
        </p>
      )}

      <FormDialog
        open={adding}
        title="Add a member"
        onClose={() => {
          setAdding(false);
          setPicked(null);
        }}
      >
        <form className="form" onSubmit={add}>
          <UserPicker users={[]} value={picked} onChange={setPicked} excludeIds={list.map((m) => m.userId)} onError={setError} />
          <label>
            Role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as OrganizationRole);
                setAddPerms(grantable(DEFAULT_PERMISSIONS));
              }}
            >
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </label>
          {role === 'ORGANIZER' && (
            <fieldset className="team-perms-box">
              <legend className="small">What this organizer can manage</legend>
              <PermissionChecks value={grantable(addPerms)} onChange={setAddPerms} held={held} />
            </fieldset>
          )}
          {role === 'CHECK_IN_STAFF' && (
            <label className="check-row" title={held.includes('SCANNER_APP') ? undefined : "You don't have this permission yourself"}>
              <input type="checkbox" checked={addScanner} disabled={!held.includes('SCANNER_APP')} onChange={(e) => setAddScanner(e.target.checked)} />
              <span>
                Can upload the scanner app <span className="muted small">· shared by every organization</span>
              </span>
            </label>
          )}
          <p className="small muted">
            Ask the person to open their profile and show you their My QR code (or send you the picture), then scan it
            here. The owner role can&apos;t be assigned.
          </p>
          <ErrorBox message={error} />
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setPicked(null);
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" disabled={!picked || busy}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </FormDialog>

      <FormDialog open={editing !== null} title={editing ? `Edit ${nameOf(editing)}` : 'Edit member'} onClose={() => setEditing(null)}>
        <form className="form" onSubmit={saveRoles}>
          <p className="small muted">
            Their name, email and phone number belong to their own account, so only they can change them.
          </p>
          <fieldset>
            <legend>Roles</legend>
            {ASSIGNABLE.map((r) => (
              <div key={r}>
                <label className="check-row">
                  <input type="checkbox" checked={editRoles.includes(r)} onChange={() => setEditRoles((rs) => toggle(rs, r))} />
                  {humanize(r)}
                </label>
                {r === 'ORGANIZER' && editRoles.includes('ORGANIZER') && (
                  <PermissionChecks value={editPerms} onChange={setEditPerms} held={held} />
                )}
                {r === 'CHECK_IN_STAFF' && editRoles.includes('CHECK_IN_STAFF') && !editRoles.includes('ORGANIZER') && (
                  <label className="check-row" title={held.includes('SCANNER_APP') ? undefined : "You don't have this permission yourself"}>
                    <input type="checkbox" checked={editScanner} disabled={!held.includes('SCANNER_APP')} onChange={(e) => setEditScanner(e.target.checked)} />
                    <span>
                      Can upload the scanner app <span className="muted small">· shared by every organization</span>
                    </span>
                  </label>
                )}
              </div>
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
