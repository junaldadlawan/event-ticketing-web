import { useState } from 'react';
import { CategorySelect } from './CategorySelect';
import { SearchIcon } from './DesignerIcons';

/** The pill search bar: what you want to see and which kind, with the round search button at its end. */
export function SearchBar({
  onSearch,
  keyword: initialKeyword = '',
  category: initialCategory = '',
}: {
  onSearch: (keyword: string, category: string) => void;
  /** What the search starts with (the Events page keeps it in its address). */
  keyword?: string;
  category?: string;
}) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState(initialCategory);
  return (
    <form
      className="search-pill"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(keyword.trim(), category);
      }}
    >
      <label className="search-pill-part">
        <span className="search-pill-caption">Search</span>
        <input placeholder="Event name or keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </label>
      <label className="search-pill-part">
        <span className="search-pill-caption">Category</span>
        <CategorySelect emptyLabel="Any category" value={category} onChange={setCategory} />
      </label>
      <button className="search-pill-go" type="submit" aria-label="Search events" title="Search events">
        <SearchIcon />
      </button>
    </form>
  );
}
