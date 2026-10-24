import { useParams } from 'react-router-dom';
import { eventApi, ticketTypeApi } from '../../api/endpoints';
import { useHasPermission } from '../../auth/useCanManage';
import { EventReport } from '../../components/SalesInsights';
import { ErrorBox, Spinner } from '../../components/ui';
import { useAsync } from '../../utils/useAsync';

/** The printable report of an event's figures (for people with analytics access to it). */
export function EventReportPage() {
  const { eventId = '' } = useParams();
  const { data, error, loading } = useAsync(() => Promise.all([eventApi.get(eventId), ticketTypeApi.list(eventId)]), [eventId]);
  const canAnalytics = useHasPermission('ANALYTICS', data?.[0].organizationId);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Event not found'} />;
  if (!canAnalytics) return <ErrorBox message="You do not have access to this event's figures." />;
  return <EventReport event={data[0]} ticketTypes={data[1]} />;
}
