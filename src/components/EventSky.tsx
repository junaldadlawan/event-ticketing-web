import { assetUrl } from '../api/client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Event } from '../api/types';
import { EventImage } from './EventImage';

/** The event's picture over its title block, or the slab when it has no picture or the picture fails to load. */
export function EventCover({ event, children }: { event: Event; children: ReactNode }) {
  const src = assetUrl(event.images?.find((u) => u && u.trim())) ?? null;
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
    if (!src) return;
    const img = new Image();
    img.onload = () => setOk(true);
    img.src = src;
  }, [src]);
  if (!ok) return <EventSky>{children}</EventSky>;
  return (
    <>
      <EventImage event={event} size="lg" className="event-banner" />
      {children}
    </>
  );
}

/** The cover for an event with no picture: its title block on the ticket slab. */
export function EventSky({ children }: { children: ReactNode }) {
  return (
    <section className="event-sky slab">
      <div className="event-sky-body">{children}</div>
    </section>
  );
}
