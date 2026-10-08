import { useAvatar } from '../utils/avatar';

/** Round profile picture, or the user's initials when none was added. */
export function Avatar({ userId, name, size = 32 }: { userId: string; name: string; size?: number }) {
  const src = useAvatar(userId);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}
