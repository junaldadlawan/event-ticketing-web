import { useState } from 'react';
import { ListIcon } from './EventCollection';

export type PostView = 'cards' | 'list';

/** Cards / list choice for the admin posts, remembered in this browser. */
export function usePostView(storageKey = 'et.postsView') {
  const [view, setView] = useState<PostView>(() => {
    try {
      return localStorage.getItem(storageKey) === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  });
  function changeView(next: PostView) {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* blocked storage: it just won't be remembered */
    }
  }
  return [view, changeView] as const;
}

function CardsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 5h7M4.5 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4.5" y="10.25" width="7" height="1.75" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Two icon buttons: list (compact rows) and cards (full posts). */
export function PostViewToggle({ view, onChange }: { view: PostView; onChange: (v: PostView) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Post layout">
      <button
        type="button"
        title="List view"
        aria-label="List view"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
      >
        <ListIcon />
      </button>
      <button
        type="button"
        title="Card view"
        aria-label="Card view"
        aria-pressed={view === 'cards'}
        onClick={() => onChange('cards')}
      >
        <CardsIcon />
      </button>
    </div>
  );
}
