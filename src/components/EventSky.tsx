import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Event } from '../api/types';
import { EventImage } from './EventImage';

/** The event's picture over its title block, or the sky when it has no picture or the picture fails to load. */
export function EventCover({ event, day, children }: { event: Event; day: boolean; children: ReactNode }) {
  const src = event.images?.find((u) => u && u.trim()) ?? null;
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
    if (!src) return;
    const img = new Image();
    img.onload = () => setOk(true);
    img.src = src;
  }, [src]);
  if (!ok) return <EventSky day={day}>{children}</EventSky>;
  return (
    <>
      <EventImage event={event} size="lg" className="event-banner" />
      {children}
    </>
  );
}

/**
 * The cover for an event with no picture: a sky that matches when it happens. A daytime event gets a sun in a
 * warm sky, an evening one a moon and stars in a night sky; the crowd on the horizon is the same for both.
 * The title block goes inside (it is passed as children).
 */
export function EventSky({ day, children }: { day: boolean; children: ReactNode }) {
  return (
    <section className={`event-sky ${day ? 'is-day' : 'is-night'}`}>
      <svg className="event-sky-art" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <mask id="event-moon-cut">
            <rect width="1200" height="340" fill="#fff" />
            <circle cx="962" cy="112" r="42" fill="#000" />
          </mask>
        </defs>
        {day ? (
          <>
            <circle className="sun-glow" cx="930" cy="130" r="118" />
            <g className="event-sun-rays"><line x1="996.0" y1="130.0" x2="1022.0" y2="130.0" /><line x1="989.5" y1="158.6" x2="1002.1" y2="164.7" /><line x1="971.2" y1="181.6" x2="987.4" y2="201.9" /><line x1="944.7" y1="194.3" x2="947.8" y2="208.0" /><line x1="915.3" y1="194.3" x2="909.5" y2="219.7" /><line x1="888.8" y1="181.6" x2="880.1" y2="192.5" /><line x1="870.5" y1="158.6" x2="847.1" y2="169.9" /><line x1="864.0" y1="130.0" x2="850.0" y2="130.0" /><line x1="870.5" y1="101.4" x2="847.1" y2="90.1" /><line x1="888.8" y1="78.4" x2="880.1" y2="67.5" /><line x1="915.3" y1="65.7" x2="909.5" y2="40.3" /><line x1="944.7" y1="65.7" x2="947.8" y2="52.0" /><line x1="971.2" y1="78.4" x2="987.4" y2="58.1" /><line x1="989.5" y1="101.4" x2="1002.1" y2="95.3" /></g>
            <circle className="sun-core" cx="930" cy="130" r="52" />
          </>
        ) : (
          <>
            <circle className="moon-glow" cx="930" cy="120" r="100" />
            <circle className="moon" cx="930" cy="120" r="54" mask="url(#event-moon-cut)" />
            <g className="stars"><circle cx="90" cy="50" r="1.8" /><circle cx="190" cy="120" r="1.3" /><circle cx="300" cy="40" r="1.6" /><circle cx="420" cy="100" r="1.2" /><circle cx="520" cy="60" r="1.7" /><circle cx="640" cy="130" r="1.3" /><circle cx="740" cy="36" r="1.5" /><circle cx="820" cy="90" r="1.2" /><circle cx="1060" cy="60" r="1.7" /><circle cx="1130" cy="140" r="1.4" /><circle cx="1170" cy="40" r="1.3" /><circle cx="980" cy="170" r="1.2" /><circle cx="260" cy="170" r="1.2" /><circle cx="600" cy="190" r="1.1" /></g>
          </>
        )}
        <g className="crowd"><circle cx="20" cy="300" r="14" /><ellipse cx="20" cy="330" rx="25" ry="22" /><path d="M20 322 L30 276" /><circle cx="70" cy="294" r="14" /><ellipse cx="70" cy="324" rx="25" ry="22" /><circle cx="120" cy="304" r="14" /><ellipse cx="120" cy="334" rx="25" ry="22" /><path d="M120 326 L110 280" /><circle cx="170" cy="292" r="14" /><ellipse cx="170" cy="322" rx="25" ry="22" /><circle cx="220" cy="302" r="14" /><ellipse cx="220" cy="332" rx="25" ry="22" /><path d="M220 324 L230 278" /><circle cx="270" cy="296" r="14" /><ellipse cx="270" cy="326" rx="25" ry="22" /><circle cx="320" cy="306" r="14" /><ellipse cx="320" cy="336" rx="25" ry="22" /><path d="M320 328 L310 282" /><circle cx="370" cy="293" r="14" /><ellipse cx="370" cy="323" rx="25" ry="22" /><circle cx="420" cy="301" r="14" /><ellipse cx="420" cy="331" rx="25" ry="22" /><path d="M420 323 L430 277" /><circle cx="470" cy="297" r="14" /><ellipse cx="470" cy="327" rx="25" ry="22" /><circle cx="520" cy="305" r="14" /><ellipse cx="520" cy="335" rx="25" ry="22" /><path d="M520 327 L510 281" /><circle cx="570" cy="295" r="14" /><ellipse cx="570" cy="325" rx="25" ry="22" /><circle cx="620" cy="300" r="14" /><ellipse cx="620" cy="330" rx="25" ry="22" /><path d="M620 322 L630 276" /><circle cx="670" cy="294" r="14" /><ellipse cx="670" cy="324" rx="25" ry="22" /><circle cx="720" cy="304" r="14" /><ellipse cx="720" cy="334" rx="25" ry="22" /><path d="M720 326 L710 280" /><circle cx="770" cy="292" r="14" /><ellipse cx="770" cy="322" rx="25" ry="22" /><circle cx="820" cy="302" r="14" /><ellipse cx="820" cy="332" rx="25" ry="22" /><path d="M820 324 L830 278" /><circle cx="870" cy="296" r="14" /><ellipse cx="870" cy="326" rx="25" ry="22" /><circle cx="920" cy="306" r="14" /><ellipse cx="920" cy="336" rx="25" ry="22" /><path d="M920 328 L910 282" /><circle cx="970" cy="293" r="14" /><ellipse cx="970" cy="323" rx="25" ry="22" /><circle cx="1020" cy="301" r="14" /><ellipse cx="1020" cy="331" rx="25" ry="22" /><path d="M1020 323 L1030 277" /><circle cx="1070" cy="297" r="14" /><ellipse cx="1070" cy="327" rx="25" ry="22" /><circle cx="1120" cy="305" r="14" /><ellipse cx="1120" cy="335" rx="25" ry="22" /><path d="M1120 327 L1110 281" /><circle cx="1170" cy="295" r="14" /><ellipse cx="1170" cy="325" rx="25" ry="22" /><circle cx="1220" cy="300" r="14" /><ellipse cx="1220" cy="330" rx="25" ry="22" /><path d="M1220 322 L1230 276" /><rect x="0" y="330" width="1200" height="10" /></g>
      </svg>
      <div className="event-sky-body">{children}</div>
    </section>
  );
}
