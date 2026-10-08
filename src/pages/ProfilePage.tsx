import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { userApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { MyQrCard } from '../components/MyQrCard';
import { ErrorBox, SuccessBox } from '../components/ui';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  if (!user) return null;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    try {
      setUser(await userApi.updateMe({ name, email }));
      setProfileMsg('Profile updated.');
    } catch (err) {
      setProfileErr(errorMessage(err));
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    try {
      await userApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setPwMsg('Password changed.');
    } catch (err) {
      setPwErr(errorMessage(err));
    }
  }

  return (
    <>
      <h1>Profile</h1>
      <div className="two-col">
        <section className="card">
          <h2>Details</h2>
          <p className="muted small">
            User ID <code>{user.id}</code> (share this to receive ticket transfers) · Role{' '}
            {user.role}
          </p>
          <ErrorBox message={profileErr} />
          <SuccessBox message={profileMsg} />
          <form className="form" onSubmit={saveProfile}>
            <label>
              Name
              <input value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn btn-primary">Save</button>
          </form>
        </section>
        <section className="card">
          <h2>Change password</h2>
          <ErrorBox message={pwErr} />
          <SuccessBox message={pwMsg} />
          <form className="form" onSubmit={changePassword}>
            <label>
              Current password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <button className="btn btn-primary">Change password</button>
          </form>
        </section>
      </div>
      <MyQrCard userId={user.id} name={user.name} />
    </>
  );
}
