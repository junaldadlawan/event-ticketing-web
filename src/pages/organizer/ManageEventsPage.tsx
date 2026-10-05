import { useState } from 'react';
import { Link } from 'react-router-dom';
import { eventApi } from '../../api/endpoints';
import type { EventStatus } from '../../api/types';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge } from '../../components/ui';
import { formatDateTime, humanize } from '../../utils/format';
import { useAsync } from '../../utils/useAsync';

const STATUSES: EventStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'ON_SALE',
  'SOLD_OUT',
  'CANCELLED',
  'COMPLETED',
  'SUSPENDED',
];

export function ManageEventsPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const { data, error, loading } = useAsync(
    () =>
      eventApi.managed({
        page,
        size: 20,
        sort: 'startAt,desc',
        status: status || undefined,
      }),
    [page, status],
  );

  return (
    <>
      <div className="row-between">
        <h1>Manage events</h1>
        <Link to="/manage/new" className="btn btn-primary">
          New event
        </Link>
      </div>
      <p className="muted small">
        Events from organizations where you are an owner or organizer (admins see all).
      </p>
      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EventStatus | '');
            setPage(0);
          }}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Empty>No events to manage.</Empty>
      ) : (
        data && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Starts</th>
                  <th>Prefix</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <Link to={`/manage/events/${ev.id}`}>{ev.title}</Link>
                    </td>
                    <td>{formatDateTime(ev.startAt, ev.timezone)}</td>
                    <td>
                      <code>{ev.ticketPrefix}</code>
                    </td>
                    <td>
                      <StatusBadge status={ev.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
