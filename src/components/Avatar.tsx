import { assetUrl } from '../api/client';

/** Round profile picture, or the user's initials when there is none. */
export function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(14, size * 0.4) }} aria-hidden="true">
      {src ? <img src={assetUrl(src)} alt="" /> : initials}
    </span>
  );
}
