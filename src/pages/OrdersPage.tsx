import { useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../api/endpoints';
import { Empty, ErrorBox, Pagination, Spinner, StatusBadge } from '../components/ui';
import { formatDateTime, formatMoney } from '../utils/format';
import { useAsync } from '../utils/useAsync';

export function OrdersPage() {
  const [page, setPage] = useState(0);
  const { data, error, loading } = useAsync(
    () => orderApi.mine({ page, size: 20, sort: 'createdAt,desc' }),
    [page],
  );

  return (
    <>
      <h1>
        My orders
        {data && data.totalElements > 0 && (
          <span className="count-badge" aria-label={`${data.totalElements} orders`}>
            {data.totalElements}
          </span>
        )}
      </h1>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Empty>
          No orders yet. <Link to="/">Find an event</Link>
        </Empty>
      ) : (
        data && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Tickets</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((o, i) => (
                  <tr key={o.id}>
                    <td>{page * data.size + i + 1}</td>
                    <td>
                      <Link to={`/orders/${o.id}`}>
                        <code>{o.id.slice(0, 8)}</code>
                      </Link>
                    </td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td>{o.tickets.length}</td>
                    <td>{formatMoney(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
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
