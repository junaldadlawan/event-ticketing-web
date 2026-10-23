import { ProfileTabs } from '../components/ProfileTabs';
import { useRef, useState } from 'react';
import { fullName, formatDate } from '../utils/format';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { uploadApi, userApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { EditIcon, QrIcon } from '../components/DesignerIcons';
import { MyQrDialog } from '../components/MyQrCard';
import { ErrorBox, SuccessBox, PageHeader } from '../components/ui';
import { squareAvatarFile } from '../utils/avatar';
import { BirthdateField } from '../components/BirthdateField';
import { PasswordStrength } from '../components/PasswordStrength';
import { PhoneField } from '../components/PhoneField';
import { birthDateError, nameError, phoneError } from '../utils/validation';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = user?.avatarUrl ?? null;
  const [photoBusy, setPhotoBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [middleName, setMiddleName] = useState(user?.middleName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [changingPw, setChangingPw] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const invalid =
      nameError(firstName, 'First name') ??
      (middleName.trim() ? nameError(middleName, 'Middle name') : null) ??
      nameError(lastName, 'Last name');
    if (invalid) {
      setErr(invalid);
      return;
    }
    try {
      // Email is the login identity, so it is shown but not editable here (and not sent: an older account
      // whose email predates the character rules would otherwise be refused when only the name changes).
      setUser(await userApi.updateMe({ firstName: firstName.trim(), middleName: middleName.trim(), lastName: lastName.trim() }));
      setEditingName(false);
      setMsg('Name updated.');
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await userApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setChangingPw(false);
      setMsg('Password changed.');
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }

  return (
    <ProfileTabs>
    <div className="profile-page">
      <PageHeader title="Profile" />
      <ErrorBox message={err} />
      <SuccessBox message={msg} />

      <div className="profile-photo">
        <Avatar src={avatar} name={fullName(user)} size={80} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setErr(null);
            setPhotoBusy(true);
            try {
              const uploaded = await uploadApi.image(await squareAvatarFile(file), 'users');
              setUser(await userApi.updateMe({ avatarUrl: uploaded.url }));
            } catch (e2) {
              setErr(errorMessage(e2));
            } finally {
              setPhotoBusy(false);
            }
          }}
        />
        <button
          type="button"
          className="profile-photo-edit"
          disabled={photoBusy}
          onClick={() => fileRef.current?.click()}
          title={avatar ? 'Change photo' : 'Add photo'}
          aria-label={avatar ? 'Change photo' : 'Add photo'}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="profile-photo-qr"
          onClick={() => setQrOpen(true)}
          title="My QR"
          aria-label="Show my QR code"
        >
          <QrIcon />
        </button>
        {avatar && (
          <button
            type="button"
            className="btn-link profile-photo-remove"
            disabled={photoBusy}
            onClick={async () => {
              setErr(null);
              setPhotoBusy(true);
              try {
                setUser(await userApi.updateMe({ avatarUrl: '' }));
              } catch (e2) {
                setErr(errorMessage(e2));
              } finally {
                setPhotoBusy(false);
              }
            }}
          >
            Remove
          </button>
        )}
      </div>

      <dl className="profile-list">
        <div className="profile-row">
          <dt>Name</dt>
          {editingName ? (
            <dd>
              <form className="profile-inline" onSubmit={saveName}>
                <input
                  autoFocus
                  required
                  value={firstName}
                  maxLength={150}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  aria-label="First name"
                />
                <input
                  value={middleName}
                  maxLength={150}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name (optional)"
                  aria-label="Middle name"
                />
                <input
                  required
                  value={lastName}
                  maxLength={150}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  aria-label="Last name"
                />
                <button className="btn btn-primary btn-sm">Save</button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setFirstName(user.firstName);
                    setMiddleName(user.middleName ?? '');
                    setLastName(user.lastName);
                    setEditingName(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            </dd>
          ) : (
            <>
              <dd>{fullName(user)}</dd>
              <button type="button" className="btn-link" onClick={() => setEditingName(true)}>
                Edit
              </button>
            </>
          )}
        </div>
        <div className="profile-row">
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <EditableRow
          label="Phone"
          display={user.phoneNumber || null}
          initial={user.phoneNumber ?? ''}
          type="tel"
          validate={phoneError}
          onSave={async (value) => setUser(await userApi.updateMe({ phoneNumber: value.trim() }))}
        />
        <EditableRow
          label="Birthdate"
          display={user.birthDate ? formatDate(user.birthDate) : null}
          initial={user.birthDate ?? ''}
          type="birthdate"
          validate={birthDateError}
          onSave={async (value) => setUser(await userApi.updateMe({ birthDate: value }))}
        />
        <div className="profile-row">
          <dt>Password</dt>
          {changingPw ? (
            <dd>
              <form className="profile-inline profile-pw" onSubmit={changePassword}>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Current password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="New password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <div className="pw-wide">
                  <PasswordStrength password={next} avoid={[user.firstName, user.lastName, user.email.split('@')[0] ?? '']} />
                </div>
                <button className="btn btn-primary btn-sm">Update</button>
                <button type="button" className="btn btn-sm" onClick={() => setChangingPw(false)}>
                  Cancel
                </button>
              </form>
            </dd>
          ) : (
            <>
              <dd>••••••••</dd>
              <button type="button" className="btn-link" onClick={() => setChangingPw(true)}>
                Change
              </button>
            </>
          )}
        </div>
      </dl>

      <MyQrDialog open={qrOpen} onClose={() => setQrOpen(false)} userId={user.id} name={fullName(user)} />
    </div>
    </ProfileTabs>
  );
}

/** A profile row with an Edit link that turns the value into one small form. */
function EditableRow({
  label,
  display,
  initial,
  type,
  validate,
  onSave,
}: {
  label: string;
  display: string | null;
  initial: string;
  type: 'tel' | 'birthdate';
  validate: (value: string) => string | null;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validate(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      await onSave(value);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="profile-row">
      <dt>{label}</dt>
      {editing ? (
        <dd>
          <form className="profile-inline" onSubmit={submit}>
            {type === 'birthdate' ? (
              <BirthdateField value={value} onChange={setValue} />
            ) : (
              <PhoneField value={value} onChange={setValue} />
            )}
            <button className="btn btn-primary btn-sm">Save</button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setValue(initial);
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </form>
          <ErrorBox message={error} />
        </dd>
      ) : (
        <>
          <dd>{display ?? <span className="muted">Not added</span>}</dd>
          <button type="button" className="btn-link" onClick={() => setEditing(true)}>
            {display ? 'Edit' : 'Add'}
          </button>
        </>
      )}
    </div>
  );
}
