/**
 * The sign-up / log-in panel art: one sky that runs from sunrise to midnight, with a crowd on the horizon, so a day
 * event and a night event both belong in it. `flipped` mirrors it (moon on the left) for the log-in page.
 */
export function AuthSky({ flipped = false }: { flipped?: boolean }) {
  return (
    <div className={`signup-sky${flipped ? ' is-flipped' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
                  <defs>
                    <mask id="signup-moon-cut">
                      <rect width="400" height="300" fill="#fff" />
                      <circle cx="324" cy="96" r="29" fill="#000" />
                    </mask>
                  </defs>
                  <circle className="sun-glow" cx="92" cy="150" r="70" />
                  <g className="sun-rays"><line x1="138.0" y1="150.0" x2="154.0" y2="150.0" /><line x1="131.8" y1="173.0" x2="140.5" y2="178.0" /><line x1="115.0" y1="189.8" x2="123.0" y2="203.7" /><line x1="92.0" y1="196.0" x2="92.0" y2="206.0" /><line x1="69.0" y1="189.8" x2="61.0" y2="203.7" /><line x1="52.2" y1="173.0" x2="43.5" y2="178.0" /><line x1="46.0" y1="150.0" x2="30.0" y2="150.0" /><line x1="52.2" y1="127.0" x2="43.5" y2="122.0" /><line x1="69.0" y1="110.2" x2="61.0" y2="96.3" /><line x1="92.0" y1="104.0" x2="92.0" y2="94.0" /><line x1="115.0" y1="110.2" x2="123.0" y2="96.3" /><line x1="131.8" y1="127.0" x2="140.5" y2="122.0" /></g>
                  <circle className="sun-core" cx="92" cy="150" r="34" />
                  <circle className="moon" cx="308" cy="108" r="31" mask="url(#signup-moon-cut)" />
                  <g className="stars"><circle cx="250" cy="40" r="1.6" /><circle cx="352" cy="52" r="1.4" /><circle cx="380" cy="120" r="1.6" /><circle cx="270" cy="150" r="1.2" /><circle cx="340" cy="176" r="1.4" /></g>
                  <g className="crowd"><circle cx="22" cy="266" r="13" /><ellipse cx="22" cy="295" rx="23" ry="21" /><path d="M22 288 L31 244" /><circle cx="66" cy="258" r="13" /><ellipse cx="66" cy="287" rx="23" ry="21" /><circle cx="112" cy="268" r="13" /><ellipse cx="112" cy="297" rx="23" ry="21" /><path d="M112 290 L103 246" /><circle cx="158" cy="256" r="13" /><ellipse cx="158" cy="285" rx="23" ry="21" /><circle cx="206" cy="266" r="13" /><ellipse cx="206" cy="295" rx="23" ry="21" /><path d="M206 288 L215 244" /><circle cx="252" cy="258" r="13" /><ellipse cx="252" cy="287" rx="23" ry="21" /><circle cx="298" cy="268" r="13" /><ellipse cx="298" cy="297" rx="23" ry="21" /><path d="M298 290 L289 246" /><circle cx="344" cy="260" r="13" /><ellipse cx="344" cy="289" rx="23" ry="21" /><circle cx="386" cy="266" r="13" /><ellipse cx="386" cy="295" rx="23" ry="21" /><path d="M386 288 L395 244" /><rect x="0" y="288" width="400" height="12" /></g>
                </svg>
    </div>
  );
}
