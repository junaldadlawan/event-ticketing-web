import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { adminUserApi, moderationApi, organizationApi } from '../../api/endpoints';
import type { ModerationActionType, OrganizationRole, Role, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canModerate } from '../../auth/roles';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ChevronDownIcon, EditIcon, SearchIcon, TrashIcon } from '../../components/DesignerIcons';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, Spinner, SuccessBox, PageHeader } from '../../components/ui';
import { formatDateTime, fullName, humanize } from '../../utils/format';
import { BirthdateField } from '../../components/BirthdateField';
import { PhoneField } from '../../components/PhoneField';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';
import { ReasonForm } from './ReasonForm';

type RoleFilter = 'ALL' | Role | OrganizationRole;

/** Who holds which role in which organization. The account role is only Customer / Admin; owner, organizer and
 * check-in staff are memberships, so they come from each organization's member list. */
async function loadMemberships(): Promise<Map<string, { orgId: string; orgName: string; role: OrganizationRole }[]>> {
  const orgs = await organizationApi.list('APPROVED');
  const lists = await Promise.all(orgs.map((o) => organizationApi.members(o.id).catch(() => [])));
  const byUser = new Map<string, { orgId: string; orgName: string; role: OrganizationRole }[]>();
  lists.forEach((members, i) =>
    members.forEach((mem) =>
      mem.roles.forEach((role) => byUser.set(mem.userId, [...(byUser.get(mem.userId) ?? []), { orgId: orgs[i].id, orgName: orgs[i].name, role }])),
    ),
  );
  return byUser;
}

/** Admin tab: every account, with edit (name, email, role), suspend / reinstate and delete. */
export function AdminUsersPage() {
  return (
    <AdminOnly>
      <UsersManager />
    </AdminOnly>
  );
}

function UsersManager() {
  const { user: me } = useAuth();
  const users = useAsync(() => adminUserApi.list(), []);
  const memberships = useAsync(loadMemberships, []);
  // The Organizations page links here with ?q=<email> to open the list already searched.
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [editing, setEditing] = useState<User | null>(null);
  const [moderating, setModerating] = useState<{ user: User; action: ModerationActionType } | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  // Id of the user whose organizations menu is open.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data ?? [])
      .filter(
        (u) =>
          role === 'ALL' || u.role === role || memberships.data?.get(u.id)?.some((mem) => mem.role === role),
      )
      .filter((u) => !q || fullName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users.data, memberships.data, query, role]);

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => !(e.target as Element).closest('.admin-menu') && setMenuFor(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuFor(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuFor]);

  async function confirmDelete() {
    const u = deleting;
    setDeleting(null);
    if (!u) return;
    setErr(null);
    setMsg(null);
    try {
      await adminUserApi.remove(u.id);
      setMsg(`${fullName(u)} was deleted.`);
      users.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Users" lede="Everyone with an account. Change a name, email or role, suspend an account, or delete it." />

      <div className="admin-toolbar">
        <label className="admin-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} aria-label="Filter by role">
          <option value="ALL">All roles</option>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="ADMIN">Admins</option>
          <option value="CUSTOMER">Customers</option>
          <option value="OWNER">Organization owners</option>
          <option value="ORGANIZER">Organizers</option>
          <option value="CHECK_IN_STAFF">Check-in staff</option>
        </select>
        <span className="muted small">
          {list.length} {list.length === 1 ? 'user' : 'users'}
        </span>
      </div>

      <ErrorBox message={users.error ?? err} />
      <SuccessBox message={msg} />
      {users.loading && !users.data ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty>No users match.</Empty>
      ) : (
        <table className="table admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Joined</th>
              <th aria-label="Actions" />
              <th aria-label="Organizations" />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const isMe = u.id === me?.id;
              const suspended = u.accountStatus === 'SUSPENDED';
              return (
                <tr key={u.id} className={suspended ? 'is-suspended' : undefined}>
                  <td>
                    <div className="admin-person">
                      <Avatar src={u.avatarUrl} name={fullName(u)} size={32} />
                      <div>
                        <strong>{fullName(u)}</strong>
                        {isMe && <span className="muted small"> (you)</span>}
                        {suspended && <span className="status-chip status-bad admin-chip">Suspended</span>}
                        <div className="muted small">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-chip ${u.role === 'CUSTOMER' ? 'status-good' : 'status-info'}`}>
                      {humanize(u.role)}
                    </span>
                    {memberships.data?.get(u.id)?.map((mem) => (
                      <span
                        key={mem.orgName + mem.role}
                        className="status-chip status-info admin-chip"
                        title={mem.orgName}
                      >
                        {humanize(mem.role)}
                      </span>
                    ))}
                  </td>
                  <td className="muted small">{formatDateTime(u.createdAt)}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit user"
                        aria-label={`Edit ${fullName(u)}`}
                        onClick={() => setEditing(u)}
                      >
                        <EditIcon />
                      </button>
                      {!isMe && canModerate(me?.role, u.role) && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setModerating({ user: u, action: suspended ? 'REINSTATE' : 'SUSPEND' })}
                        >
                          {suspended ? 'Reinstate' : 'Suspend'}
                        </button>
                      )}
                      {!isMe && (
                        <>
                          <button
                            type="button"
                            className="icon-button icon-button-danger"
                            title="Delete user"
                            aria-label={`Delete ${fullName(u)}`}
                            onClick={() => setDeleting(u)}
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="admin-menu">
                    <button
                      type="button"
                      className="icon-button admin-expand"
                      aria-haspopup="menu"
                      aria-expanded={menuFor === u.id}
                      aria-label={`Organizations of ${fullName(u)}`}
                      onClick={() => setMenuFor(menuFor === u.id ? null : u.id)}
                    >
                      <ChevronDownIcon />
                    </button>
                    {menuFor === u.id && (
                      <div className="menu" role="menu" aria-label="Organizations">
                        {memberships.data?.get(u.id)?.length ? (
                          memberships.data.get(u.id)!.map((mem) => (
                            <Link
                              key={mem.orgId + mem.role}
                              to={`/admin/organizations?q=${encodeURIComponent(mem.orgName)}`}
                              state={{ from: '/admin/users' }}
                              role="menuitem"
                              className="menu-item"
                            >
                              {mem.orgName} · {humanize(mem.role)}
                            </Link>
                          ))
                        ) : (
                          <span className="menu-empty">Nothing to show</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <FormDialog open={editing !== null} title="Edit user" onClose={() => setEditing(null)}>
        {editing && (
          <EditUserForm
            user={editing}
            isMe={editing.id === me?.id}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setMsg('User updated.');
              users.reload();
            }}
          />
        )}
      </FormDialog>

      <FormDialog
        open={moderating !== null}
        title={moderating?.action === 'REINSTATE' ? 'Reinstate account' : 'Suspend account'}
        onClose={() => setModerating(null)}
      >
        {moderating && (
          <ReasonForm
            intro={
              moderating.action === 'REINSTATE'
                ? `${fullName(moderating.user)} will be able to sign in again.`
                : `${fullName(moderating.user)} will not be able to sign in until you reinstate the account.`
            }
            confirmLabel={moderating.action === 'REINSTATE' ? 'Reinstate' : 'Suspend'}
            danger={moderating.action === 'SUSPEND'}
            onCancel={() => setModerating(null)}
            onSubmit={async (reason) => {
              await moderationApi.create({
                targetType: 'USER',
                targetId: moderating.user.id,
                action: moderating.action,
                reason,
              });
              setModerating(null);
              setMsg(moderating.action === 'REINSTATE' ? 'Account reinstated.' : 'Account suspended.');
              users.reload();
            }}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting ? fullName(deleting) : 'this user'}?`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        The account is removed and the person can no longer sign in. Their past orders and tickets stay on record. To
        block someone for now, suspend the account instead.
      </ConfirmDialog>
    </>
  );
}

function EditUserForm({
  user,
  isMe,
  onCancel,
  onSaved,
}: {
  user: User;
  isMe: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [middleName, setMiddleName] = useState(user.middleName ?? '');
  const [lastName, setLastName] = useState(user.lastName);
  const [birthDate, setBirthDate] = useState(user.birthDate ?? '');
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminUserApi.update(user.id, {
        firstName: firstName.trim() !== user.firstName ? firstName.trim() : undefined,
        middleName: middleName.trim() !== (user.middleName ?? '') ? middleName.trim() : undefined,
        lastName: lastName.trim() !== user.lastName ? lastName.trim() : undefined,
        birthDate: birthDate && birthDate !== (user.birthDate ?? '') ? birthDate : undefined,
        phoneNumber: phone.trim() !== (user.phoneNumber ?? '') ? phone.trim() : undefined,
        email: email.trim() !== user.email ? email.trim() : undefined,
        role: role !== user.role ? role : undefined,
      });
      onSaved();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="two-col payout-dates">
        <label>
          First name
          <input required maxLength={150} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label>
          Last name
          <input required maxLength={150} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
      </div>
      <label>
        Middle name <span className="muted">(optional)</span>
        <input maxLength={150} value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
      </label>
      <div className="birth-field">
        <span>Birthdate</span>
        <BirthdateField value={birthDate} onChange={setBirthDate} />
      </div>
      <div className="birth-field">
        <span>
          Phone <span className="muted">(optional)</span>
        </span>
        <PhoneField value={phone} onChange={setPhone} />
      </div>
      <label>
        Email
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Role
        <select value={role} disabled={isMe || user.role === 'SUPER_ADMIN'} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="CUSTOMER">Customer</option>
          <option value="ADMIN">Admin</option>
          {user.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super admin</option>}
        </select>
        {(isMe || user.role === 'SUPER_ADMIN') && <small className="muted">{isMe ? "You can't change your own role." : 'The super admin role cannot be changed.'}</small>}
      </label>
      <ErrorBox message={error} />
      <div className="modal-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
