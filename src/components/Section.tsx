import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** A page section: a heading, an optional "see all" link at its end, and the content. */
export function Section({ title, to, linkLabel = 'See all', children }: { title: ReactNode; to?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="page-section">
      <div className="page-section-head">
        <h2>{title}</h2>
        {to && (
          <Link to={to} className="page-section-link">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
