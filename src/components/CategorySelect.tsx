import { useEffect, useState } from 'react';
import { categoryApi } from '../api/endpoints';
import type { Category } from '../api/types';

// Categories rarely change, so fetch once per page load and share the result.
let cached: Promise<Category[]> | null = null;

function loadCategories(): Promise<Category[]> {
  cached ??= categoryApi
    .list()
    .then((list) => [...list].sort((a, b) => a.sortOrder - b.sortOrder))
    .catch((err) => {
      cached = null; // allow a retry on the next mount
      throw err;
    });
  return cached;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCategories()
      .then((list) => !cancelled && setCategories(list))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, error };
}

/**
 * Dropdown of active categories. The value is the category *name*, which is
 * what events store and what the event search/create endpoints expect.
 */
export function CategorySelect({
  value,
  onChange,
  required,
  emptyLabel,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Label for the "" option, e.g. "All categories". Omit to force a choice. */
  emptyLabel?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const { categories, error } = useCategories();

  // Keep a current value that isn't in the active list (e.g. a category that
  // was deactivated after the event was created) instead of silently dropping it.
  // Names match case-insensitively on the API, so map e.g. "music" to the
  // option "Music" or the <select> would show nothing selected.
  const match = categories?.find((c) => c.name.toLowerCase() === value.toLowerCase());
  const showCurrent = Boolean(value) && categories !== null && !match;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={match ? match.name : value}
      required={required}
      disabled={categories === null && !error}
      onChange={(e) => onChange(e.target.value)}
    >
      {emptyLabel !== undefined ? (
        <option value="">{emptyLabel}</option>
      ) : (
        <option value="" disabled>
          {error ? 'Could not load categories' : categories ? 'Select a category' : 'Loading...'}
        </option>
      )}
      {showCurrent && <option value={value}>{value} (inactive)</option>}
      {categories?.map((c) => (
        <option key={c.id} value={c.name} title={c.description ?? undefined}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
