import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { adminUserApi, moderationApi } from '../../api/endpoints';
import type { ModerationActionType, Role, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditIcon, SearchIcon, TrashIcon } from '../../components/DesignerIcons';
import { FormDialog } from '../../components/FormDialog';
import { Empty, ErrorBox, Spinner, SuccessBox } from '../../components/ui';
import { formatDateTime, fullName } from '../../utils/format';
import { BirthdateField } from '../../components/BirthdateField';
import { PhoneField } from '../../components/PhoneField';
import { useAsync } from '../../utils/useAsync';
import { AdminOnly } from './AdminTabs';
import { ReasonForm } from './ReasonForm';

type RoleFilter = 'ALL' | Role;

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
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [editing, setEditing] = useState<User | null>(null);
  const [moderating, setModerating] = useState<{ user: User; action: ModerationActionType } | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data ?? [])
      .filter((u) => role === 'ALL' || u.role === role)
      .filter((u) => !q || fullName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users.data, query, role]);

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
      <h1>Users</h1>
      <p className="muted">Everyone with an account. Change a name, email or role, suspend an account, or delete it.</p>

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
          <option value="ADMIN">Admins</option>
          <option value="CUSTOMER">Customers</option>
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
                    <span className={`status-chip ${u.role === 'ADMIN' ? 'status-info' : 'status-good'}`}>
                      {u.role === 'ADMIN' ? 'Admin' : 'Customer'}
                    </span>
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
                      {!isMe && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setModerating({ user: u, action: suspended ? 'REINSTATE' : 'SUSPEND' })}
                          >
                            {suspended ? 'Reinstate' : 'Suspend'}
                          </button>
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
        <select value={role} disabled={isMe} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="CUSTOMER">Customer</option>
          <option value="ADMIN">Admin</option>
        </select>
        {isMe && <small className="muted">You can't change your own role.</small>}
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
