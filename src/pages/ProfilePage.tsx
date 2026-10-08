import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { userApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { EditIcon, QrIcon } from '../components/DesignerIcons';
import { MyQrDialog } from '../components/MyQrCard';
import { ErrorBox, SuccessBox } from '../components/ui';
import { removeAvatar, saveAvatar, useAvatar } from '../utils/avatar';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = useAvatar(user?.id);
  const [qrOpen, setQrOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
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
    try {
      // Email is the login identity, so it is shown but not editable here.
      setUser(await userApi.updateMe({ name: name.trim(), email: user!.email }));
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
    <div className="profile-page">
      <h1>Profile</h1>
      <ErrorBox message={err} />
      <SuccessBox message={msg} />

      <div className="profile-photo">
        <Avatar userId={user.id} name={user.name} size={80} />
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
            try {
              await saveAvatar(user.id, file);
            } catch (e2) {
              setErr(e2 instanceof Error ? e2.message : 'Could not use that picture.');
            }
          }}
        />
        <button
          type="button"
          className="profile-photo-edit"
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
          <button type="button" className="btn-link profile-photo-remove" onClick={() => removeAvatar(user.id)}>
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
                  value={name}
                  maxLength={150}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Name"
                />
                <button className="btn btn-primary btn-sm">Save</button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setName(user.name);
                    setEditingName(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            </dd>
          ) : (
            <>
              <dd>{user.name}</dd>
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

      <MyQrDialog open={qrOpen} onClose={() => setQrOpen(false)} userId={user.id} name={user.name} />
    </div>
  );
}
