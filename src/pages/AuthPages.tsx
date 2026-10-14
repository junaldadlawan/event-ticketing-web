import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useAuthDialog } from '../auth/AuthDialog';
import { AuthSky } from '../components/AuthSky';
import { BirthdateField } from '../components/BirthdateField';
import { PasswordStrength } from '../components/PasswordStrength';
import { PhoneField } from '../components/PhoneField';
import { CheckIcon, QrIcon, TicketIcon } from '../components/DesignerIcons';
import { ErrorBox } from '../components/ui';
import { birthDateError, emailError, nameError, phoneError } from '../utils/validation';

interface PanelProps {
  /** Called once the user is logged in (the pop-up closes). */
  onSuccess: () => void;
  /** Switch to the other form (log in <-> sign up) inside the pop-up. */
  onSwitch: () => void;
}

/** How long the "account created, you're logged in" screen shows before the pop-up closes by itself. */
const WELCOME_MS = 2400;

/** Log in and sign up are a pop-up window now: the old URLs open it over the home page. */
function AuthRoute({ mode }: { mode: 'login' | 'register' }) {
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
    openAuth(mode);
  }, [mode, navigate, openAuth]);
  return null;
}
export const LoginPage = () => <AuthRoute mode="login" />;
export const RegisterPage = () => <AuthRoute mode="register" />;

export function LoginPanel({ onSuccess, onSwitch }: PanelProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signup">
      <aside className="signup-promo">
        <AuthSky flipped />
        <div className="signup-copy">
          <h2>Pick up where the show left off</h2>
          <p className="signup-lede">Your tickets, orders and events are right where you left them.</p>
          <ul>
            <li>
              <QrIcon /> Open your tickets and QR codes
            </li>
            <li>
              <TicketIcon /> Follow your orders
            </li>
            <li>
              <CheckIcon /> Manage the events you host
            </li>
          </ul>
        </div>
      </aside>
      <div className="signup-card card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to see your tickets.</p>
        <ErrorBox message={error} />
        <form className="form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn signup-submit" disabled={busy}>
            {busy ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className="muted small">
          No account?{' '}
        <button type="button" className="btn-link" onClick={onSwitch}>
          Sign up
        </button>
        </p>
      </div>
    </div>
  );
}

export function RegisterPanel({ onSuccess, onSwitch }: PanelProps) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once the account exists and the user is logged in: shows the "account created" screen first.
  const [welcome, setWelcome] = useState<string | null>(null);
  const finish = useRef(onSuccess);
  useEffect(() => {
    finish.current = onSuccess;
  });
  useEffect(() => {
    if (welcome === null) return;
    const timer = window.setTimeout(() => finish.current(), WELCOME_MS);
    return () => window.clearTimeout(timer);
  }, [welcome]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid =
      nameError(firstName, 'First name') ??
      (middleName.trim() ? nameError(middleName, 'Middle name') : null) ??
      nameError(lastName, 'Last name') ??
      birthDateError(birthDate) ??
      phoneError(phone) ??
      emailError(email);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(
        {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          birthDate,
          phoneNumber: phone.trim() || undefined,
        },
        email.trim(),
        password,
      );
      setWelcome(firstName.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signup">
      <aside className="signup-promo">
        <AuthSky />
        <div className="signup-copy">
          <h2>From sunrise to the last song</h2>
          <p className="signup-lede">Tickets for the dawn run, the noon market and the midnight set.</p>
          <ul>
            <li>
              <TicketIcon /> Grab tickets in seconds
            </li>
            <li>
              <QrIcon /> Send a ticket to a friend with a QR code
            </li>
            <li>
              <CheckIcon /> Host your own events when you&apos;re ready
            </li>
          </ul>
        </div>
      </aside>
      {welcome !== null ? (
        <div className="signup-card signup-done card" role="status" aria-live="polite">
          <div className="signup-done-check" aria-hidden="true">
            <CheckIcon />
          </div>
          <h1>Account created</h1>
          <p className="muted">Welcome, {welcome}. You&apos;re logged in.</p>
          <p className="signup-done-note muted small">Taking you in...</p>
        </div>
      ) : (
      <div className="signup-card card">
        <h1>Create your account</h1>
        <p className="muted">It takes less than a minute.</p>
        <ErrorBox message={error} />
        <form className="form" onSubmit={onSubmit}>
          <div className="signup-names">
            <label>
              First name
              <input required maxLength={150} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label>
              Last name
              <input required maxLength={150} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <label>
            <span>
              Middle name <span className="hint">(optional)</span>
            </span>
            <input maxLength={150} autoComplete="additional-name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </label>
          <div className="birth-field">
            <span>Birthdate</span>
            <BirthdateField value={birthDate} onChange={setBirthDate} required />
          </div>
          <div className="birth-field">
            <span>
              Phone <span className="hint">(optional)</span>
            </span>
            <PhoneField value={phone} onChange={setPhone} />
          </div>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <PasswordStrength password={password} avoid={[firstName, lastName, email.split('@')[0] ?? '']} />
        <label>
          Confirm password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button className="btn signup-submit" disabled={busy}>
          {busy ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p className="muted small">
        Already have an account?{' '}
        <button type="button" className="btn-link" onClick={onSwitch}>
          Log in
        </button>
      </p>
      </div>
      )}
    </div>
  );
}
