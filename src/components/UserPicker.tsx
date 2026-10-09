import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../api/types';
import { parseUserQr, readQrFromImage } from '../utils/userQr';
import { Avatar } from './Avatar';
import { QrIcon, SearchIcon } from './DesignerIcons';

/**
 * Pick one person: search by name or email, or scan their "My QR" picture. `users` is who can be picked
 * (`excludeIds` are left out, e.g. people who are already members).
 */
export function UserPicker({
  users,
  value,
  onChange,
  excludeIds = [],
  onError,
}: {
  users: User[];
  value: User | null;
  onChange: (user: User | null) => void;
  excludeIds?: string[];
  /** Called with a readable message when a QR picture can't be used (null clears it). */
  onError?: (message: string | null) => void;
}) {
  // With no list of people to search (an owner cannot list users), the picker only scans a My QR picture.
  const qrOnly = users.length === 0;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const skip = new Set(excludeIds);
    return users
      .filter((u) => !skip.has(u.id) && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [users, query, excludeIds]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function pick(user: User) {
    onChange(user);
    onError?.(null);
    setQuery('');
    setOpen(false);
  }

  async function scan(file: File) {
    onError?.(null);
    try {
      const id = parseUserQr(await readQrFromImage(file));
      if (!id) {
        onError?.("That QR code isn't a user's My QR code.");
        return;
      }
      const user =
        users.find((u) => u.id === id) ??
        (qrOnly ? ({ id, name: 'Scanned member', email: `ID ${id.slice(0, 8)}…`, role: 'CUSTOMER', createdAt: '' } as User) : undefined);
      if (!user) {
        onError?.('No account was found for that QR code.');
        return;
      }
      if (excludeIds.includes(user.id)) {
        onError?.(`${user.name} is already a member.`);
        return;
      }
      pick(user);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'That picture could not be read.');
    }
  }

  return (
    <div className="user-picker" ref={root}>
      {value ? (
        <div className="user-picker-chosen">
          <Avatar src={value.avatarUrl} name={value.name} size={28} />
          <span className="user-picker-who">
            <strong>{value.name}</strong>
            <small className="muted">{value.email}</small>
          </span>
          <button type="button" className="btn-link" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      ) : (
        <div className="user-picker-field">
          {!qrOnly && (
          <label className="admin-search user-picker-search">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(0);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter' && results[active]) {
                  e.preventDefault();
                  pick(results[active]!);
                } else if (e.key === 'Escape' && open) {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
              placeholder="Search by name or email"
              aria-label="Search people"
              autoComplete="off"
              role="combobox"
              aria-expanded={open && results.length > 0}
            />
          </label>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void scan(file);
            }}
          />
          <button
            type="button"
            className={`btn btn-sm user-picker-qr${qrOnly ? '' : ' btn-icon'}`}
            onClick={() => fileRef.current?.click()}
            title="Scan QR: choose a picture of their My QR code"
            aria-label="Scan QR"
          >
            <QrIcon />
            {qrOnly && 'Scan their My QR'}
          </button>
          {open && query.trim() && (
            <ul className="user-picker-results" role="listbox">
              {results.length === 0 ? (
                <li className="user-picker-empty muted small">No one matches &quot;{query.trim()}&quot;.</li>
              ) : (
                results.map((u, i) => (
                  <li key={u.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      className={`user-picker-option${i === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(u)}
                    >
                      <Avatar src={u.avatarUrl} name={u.name} size={28} />
                      <span className="user-picker-who">
                        <strong>{u.name}</strong>
                        <small className="muted">{u.email}</small>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
