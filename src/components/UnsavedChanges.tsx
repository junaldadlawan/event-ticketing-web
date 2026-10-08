import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/** One unsaved thing, listed in the dialog; `onOpen` (optional) takes the person to it. */
export interface UnsavedItem {
  label: string;
  /** How big the unsaved change is, and why (shown as a tag next to the name). */
  severity?: 'major' | 'minor' | 'none';
  note?: string;
  onOpen?: () => void;
}

interface UnsavedChangesApi {
  /** Pages call this (via useUnsavedChanges) to say whether they have unsaved edits. */
  setDirty: (dirty: boolean, details?: UnsavedItem[]) => void;
  /** Resolves true when it's fine to leave: nothing unsaved, or the user chose to discard. */
  confirmLeave: () => Promise<boolean>;
}

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

/**
 * Asks "Discard unsaved changes?" before leaving a page with unsaved edits:
 * - the in-app Back button and Log out (they call confirmLeave);
 * - any in-app link (caught here, before React Router handles the click);
 * - closing/reloading the tab (the browser's own "Leave site?" prompt).
 * Not covered: the browser's back arrow - that needs React Router's data
 * router (createBrowserRouter + useBlocker), which this app doesn't use.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirty = useRef(false);
  // What exactly is unsaved (e.g. layout names), shown in the dialog so people know what they would lose.
  const details = useRef<UnsavedItem[]>([]);
  const [shownDetails, setShownDetails] = useState<UnsavedItem[]>([]);
  const [pending, setPending] = useState<((leave: boolean) => void) | null>(null);
  const navigate = useNavigate();

  const setDirty = useCallback((value: boolean, list: UnsavedItem[] = []) => {
    dirty.current = value;
    details.current = list;
  }, []);

  const confirmLeave = useCallback(
    () => {
      if (!dirty.current) return Promise.resolve(true);
      setShownDetails(details.current);
      return new Promise<boolean>((resolve) => setPending(() => resolve));
    },
    [],
  );

  // Closing or reloading the tab.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = ''; // required by some browsers to show the prompt
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // In-app links: catch the click in the capture phase, before <Link> sees it.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirty.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // opening in a new tab is fine
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to = url.pathname + url.search + url.hash;
      if (to === window.location.pathname + window.location.search + window.location.hash) return;
      e.preventDefault();
      e.stopPropagation();
      confirmLeave().then((leave) => {
        if (!leave) return;
        dirty.current = false;
        navigate(to);
      });
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [confirmLeave, navigate]);

  function answer(leave: boolean) {
    if (leave) dirty.current = false;
    pending?.(leave);
    setPending(null);
  }

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, confirmLeave }}>
      {children}
      {pending && <DiscardDialog details={shownDetails} onContinue={() => answer(false)} onDiscard={() => answer(true)} />}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesApi(): UnsavedChangesApi {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error('useUnsavedChangesApi must be used inside <UnsavedChangesProvider>');
  return ctx;
}

/**
 * Marks the current page as having unsaved edits while `dirty` is true. `details` names what is unsaved
 * (listed in the "Discard unsaved changes?" dialog).
 */
export function useUnsavedChanges(dirty: boolean, details: UnsavedItem[] = []) {
  const { setDirty } = useUnsavedChangesApi();
  // The items' callbacks are read through a ref, so they always see the page's latest state.
  const latest = useRef(details);
  latest.current = details;
  const key = JSON.stringify(details.map((d) => [d.label, d.severity, d.note]));
  useEffect(() => {
    const items = details.map((d) => ({ ...d, onOpen: () => latest.current.find((x) => x.label === d.label)?.onOpen?.() }));
    setDirty(dirty, items);
    return () => setDirty(false); // leaving the page clears it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, key, setDirty]);

}

function DiscardDialog({ details, onContinue, onDiscard }: { details: UnsavedItem[]; onContinue: () => void; onDiscard: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="discard-title"
      aria-describedby="discard-text"
      onCancel={(e) => {
        e.preventDefault(); // Escape = keep editing
        onContinue();
      }}
    >
      <div className="form">
        <h2 id="discard-title" className="modal-title-plain">
          Discard unsaved changes?
        </h2>
        <p id="discard-text" className="small muted">
          You have changes that haven't been saved. If you leave now, they'll be lost.
        </p>
        {details.length > 0 && (
          <>
            <p className="small">Not saved yet (click one to open it):</p>
            <ul className="small unsaved-list">
              {details.map((d) => (
                <li key={d.label}>
                  {d.onOpen ? (
                    <button
                      type="button"
                      className="btn-link unsaved-link"
                      title="Go back and open it"
                      onClick={() => {
                        onContinue();
                        d.onOpen?.();
                      }}
                    >
                      {d.label}
                    </button>
                  ) : (
                    d.label
                  )}
                  {d.severity && (
                    <span className={'change-tag change-' + d.severity} title={d.note}>
                      {d.severity === 'major' ? 'Major' : d.severity === 'minor' ? 'Minor' : 'No change'}
                      {d.note ? ': ' + d.note : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" autoFocus onClick={onContinue}>
            Continue editing
          </button>
          <button type="button" className="btn btn-danger" onClick={onDiscard}>
            Discard changes
          </button>
        </div>
      </div>
    </dialog>
  );
}
