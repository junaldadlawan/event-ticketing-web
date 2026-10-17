import type { ReactNode } from 'react';
import type { PageResponse } from '../api/types';
import { humanize } from '../utils/format';

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return <p className="muted">{label}</p>;
}

export function ErrorBox({ message }: { message: ReactNode }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  );
}

export function SuccessBox({ message }: { message: ReactNode }) {
  if (!message) return null;
  return (
    <div className="alert alert-success" role="status">
      {message}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{humanize(status)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Pagination<T>({
  page,
  onChange,
}: {
  page: PageResponse<T>;
  onChange: (p: number) => void;
}) {
  if (page.totalPage <= 1) return null;
  return (
    <nav className="pagination">
      <button className="btn" disabled={page.page === 0} onClick={() => onChange(page.page - 1)}>
        Previous
      </button>
      <span className="muted">
        Page {page.page + 1} of {page.totalPage}
      </span>
      <button className="btn" disabled={page.last} onClick={() => onChange(page.page + 1)}>
        Next
      </button>
    </nav>
  );
}
