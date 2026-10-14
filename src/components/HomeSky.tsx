/** The wide sunrise-to-midnight sky behind the Home banner: sun in the middle, moon at the far right, a crowd below. */
export function HomeSky() {
  return (
    <div className="home-sky" aria-hidden="true">
      <svg viewBox="0 0 1200 340" preserveAspectRatio="xMidYMax slice">
        <defs>
          <mask id="home-moon-cut">
            <rect width="1200" height="340" fill="#fff" />
            <circle cx="1140" cy="44" r="21" fill="#000" />
          </mask>
        </defs>
        <g transform="translate(35 -30)">
            <circle className="sun-glow" cx="560" cy="150" r="96" />
        <g className="home-sun-rays"><line x1="614.0" y1="150.0" x2="634.0" y2="150.0" /><line x1="606.8" y1="177.0" x2="617.2" y2="183.0" /><line x1="587.0" y1="196.8" x2="597.0" y2="214.1" /><line x1="560.0" y1="204.0" x2="560.0" y2="216.0" /><line x1="533.0" y1="196.8" x2="523.0" y2="214.1" /><line x1="513.2" y1="177.0" x2="502.8" y2="183.0" /><line x1="506.0" y1="150.0" x2="486.0" y2="150.0" /><line x1="513.2" y1="123.0" x2="502.8" y2="117.0" /><line x1="533.0" y1="103.2" x2="523.0" y2="85.9" /><line x1="560.0" y1="96.0" x2="560.0" y2="84.0" /><line x1="587.0" y1="103.2" x2="597.0" y2="85.9" /><line x1="606.8" y1="123.0" x2="617.2" y2="117.0" /></g>
        <circle className="sun-core" cx="560" cy="150" r="42" />
        </g>
        <circle className="moon" cx="1124" cy="54" r="26" mask="url(#home-moon-cut)" />
        <g className="stars"><circle cx="860" cy="40" r="1.6" /><circle cx="930" cy="96" r="1.3" /><circle cx="1180" cy="130" r="1.5" /><circle cx="1010" cy="150" r="1.2" /><circle cx="780" cy="120" r="1.2" /></g>
        <g className="crowd"><circle cx="20" cy="300" r="14" /><ellipse cx="20" cy="330" rx="25" ry="22" /><path d="M20 322 L30 276" /><circle cx="70" cy="294" r="14" /><ellipse cx="70" cy="324" rx="25" ry="22" /><circle cx="120" cy="304" r="14" /><ellipse cx="120" cy="334" rx="25" ry="22" /><path d="M120 326 L110 280" /><circle cx="170" cy="292" r="14" /><ellipse cx="170" cy="322" rx="25" ry="22" /><circle cx="220" cy="302" r="14" /><ellipse cx="220" cy="332" rx="25" ry="22" /><path d="M220 324 L230 278" /><circle cx="270" cy="296" r="14" /><ellipse cx="270" cy="326" rx="25" ry="22" /><circle cx="320" cy="306" r="14" /><ellipse cx="320" cy="336" rx="25" ry="22" /><path d="M320 328 L310 282" /><circle cx="370" cy="293" r="14" /><ellipse cx="370" cy="323" rx="25" ry="22" /><circle cx="420" cy="301" r="14" /><ellipse cx="420" cy="331" rx="25" ry="22" /><path d="M420 323 L430 277" /><circle cx="470" cy="297" r="14" /><ellipse cx="470" cy="327" rx="25" ry="22" /><circle cx="520" cy="305" r="14" /><ellipse cx="520" cy="335" rx="25" ry="22" /><path d="M520 327 L510 281" /><circle cx="570" cy="295" r="14" /><ellipse cx="570" cy="325" rx="25" ry="22" /><circle cx="620" cy="300" r="14" /><ellipse cx="620" cy="330" rx="25" ry="22" /><path d="M620 322 L630 276" /><circle cx="670" cy="294" r="14" /><ellipse cx="670" cy="324" rx="25" ry="22" /><circle cx="720" cy="304" r="14" /><ellipse cx="720" cy="334" rx="25" ry="22" /><path d="M720 326 L710 280" /><circle cx="770" cy="292" r="14" /><ellipse cx="770" cy="322" rx="25" ry="22" /><circle cx="820" cy="302" r="14" /><ellipse cx="820" cy="332" rx="25" ry="22" /><path d="M820 324 L830 278" /><circle cx="870" cy="296" r="14" /><ellipse cx="870" cy="326" rx="25" ry="22" /><circle cx="920" cy="306" r="14" /><ellipse cx="920" cy="336" rx="25" ry="22" /><path d="M920 328 L910 282" /><circle cx="970" cy="293" r="14" /><ellipse cx="970" cy="323" rx="25" ry="22" /><circle cx="1020" cy="301" r="14" /><ellipse cx="1020" cy="331" rx="25" ry="22" /><path d="M1020 323 L1030 277" /><circle cx="1070" cy="297" r="14" /><ellipse cx="1070" cy="327" rx="25" ry="22" /><circle cx="1120" cy="305" r="14" /><ellipse cx="1120" cy="335" rx="25" ry="22" /><path d="M1120 327 L1110 281" /><circle cx="1170" cy="295" r="14" /><ellipse cx="1170" cy="325" rx="25" ry="22" /><circle cx="1220" cy="300" r="14" /><ellipse cx="1220" cy="330" rx="25" ry="22" /><path d="M1220 322 L1230 276" /><rect x="0" y="330" width="1200" height="10" /></g>
      </svg>
    </div>
  );
}
