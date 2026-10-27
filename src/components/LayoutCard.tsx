import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UUID, VenueLayout } from '../api/types';
import { useAsync } from '../utils/useAsync';
import { LayoutThumb } from './LayoutThumb';

/** One seat layout (or preset) in a grid: its picture (fetched here, the list has none), name, seat count and actions. */
export function LayoutCard({
  id,
  name,
  seatCount,
  note,
  to,
  openLabel,
  load,
  actions,
}: {
  id: UUID;
  name: string;
  seatCount: number;
  note?: ReactNode;
  to: string;
  openLabel: string;
  load: () => Promise<VenueLayout>;
  actions?: ReactNode;
}) {
  const { data } = useAsync(load, [id]);
  return (
    <li className="layout-card">
      <Link to={to} className="layout-card-preview" aria-label={`Open ${name}`}>
        {data ? <LayoutThumb layout={data} label={`Seat layout ${name}`} /> : <span className="muted">…</span>}
      </Link>
      <strong className="layout-card-name">{name}</strong>
      <p className="muted small">
        {seatCount.toLocaleString()} {seatCount === 1 ? 'seat' : 'seats'}
        {note}
      </p>
      <div className="layout-card-actions">
        <Link to={to} className="btn btn-sm">
          {openLabel}
        </Link>
        {actions}
      </div>
    </li>
  );
}
