import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Event } from '../api/types';

type Size = 'sm' | 'md' | 'lg';

/** Cheap stable string hash (FNV-1a), so each event always gets the same colours. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Random-looking but deterministic two-tone gradient, dark enough for white text. */
function fallbackStyle(seed: string): CSSProperties {
  const h = hash(seed);
  const hue = h % 360;
  const hue2 = (hue + 25 + ((h >>> 9) % 40)) % 360;
  const angle = 100 + ((h >>> 17) % 80);
  // Yellows/greens/cyans read much brighter at equal lightness; darken them
  // so the white title keeps enough contrast.
  const light = hue >= 45 && hue <= 190 ? 30 : 42;
  return {
    background: `linear-gradient(${angle}deg, hsl(${hue} 58% ${light}%), hsl(${hue2} 62% ${light - 10}%))`,
  };
}

/**
 * The event's first image, or - when it has none or the URL fails to load -
 * a generated graphic: the event title on a colour derived from its id.
 */
export function EventImage({
  event,
  size = 'md',
  className = '',
}: {
  event: Pick<Event, 'id' | 'title' | 'images'>;
  size?: Size;
  className?: string;
}) {
  const src = event.images?.find((u) => u && u.trim()) ?? null;
  // Remember which URL failed, so a different URL gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && failedSrc !== src) {
    return (
      <img
        className={`event-image ${className}`}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <div
      className={`event-image event-fallback event-fallback-${size} ${className}`}
      style={fallbackStyle(event.id)}
      role="img"
      aria-label={event.title}
    >
      <span>{event.title}</span>
    </div>
  );
}
