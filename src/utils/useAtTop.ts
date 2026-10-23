import { useEffect, useState } from 'react';

/** True while the page is scrolled to (nearly) the top; false once it has moved more than `within` pixels. */
export function useAtTop(within = 24): boolean {
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const check = () => setAtTop(window.scrollY < within);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [within]);
  return atTop;
}
