import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useIsHost } from './useCanManage';

/**
 * Which side of the app a user who can manage things (admins, organization owners / organizers) is looking at:
 * "manage" (everything, the default) or "customer" (the app as a buyer sees it: no Manage / Posts tabs, no
 * "You manage" tags or Manage buttons). Remembered in this browser. Plain customers never see the toggle.
 */
export type ViewMode = 'manage' | 'customer';

const KEY = 'et.viewMode';

function read(): ViewMode {
  try {
    return localStorage.getItem(KEY) === 'customer' ? 'customer' : 'manage';
  } catch {
    return 'manage';
  }
}

interface ViewModeValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(read);
  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* blocked storage: it just won't be remembered */
    }
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used inside <ViewModeProvider>');
  return ctx;
}

/** True when a user who could manage things chose to browse as a customer: hide every management shortcut. */
export function useManagementHidden(): boolean {
  const isHost = useIsHost();
  const { mode } = useViewMode();
  return isHost === true && mode === 'customer';
}
