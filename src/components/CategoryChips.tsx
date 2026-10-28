import { Link } from 'react-router-dom';
import { useCategories } from './CategorySelect';

/**
 * The kinds of event as a row of pills that scrolls sideways on a narrow screen. On Home they are links into the Events
 * page; where `onPick` is given (the Events page itself) they are buttons, `active` is marked, and picking it again clears it.
 */
export function CategoryChips({ active, onPick }: { active?: string; onPick?: (category: string) => void }) {
  const { categories } = useCategories();
  if (!categories || categories.length === 0) return null;
  return (
    <nav className="category-chips" aria-label="Event categories">
      {categories.map((c) => {
        const on = Boolean(active) && active!.toLowerCase() === c.name.toLowerCase();
        return onPick ? (
          <button key={c.id} type="button" className="category-chip" aria-pressed={on} onClick={() => onPick(on ? '' : c.name)}>
            {c.name}
          </button>
        ) : (
          <Link key={c.id} to={`/events?category=${encodeURIComponent(c.name)}`} className="category-chip">
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
