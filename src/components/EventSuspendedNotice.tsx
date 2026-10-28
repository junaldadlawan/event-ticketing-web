import { eventApi } from '../api/endpoints';
import { CONTACT_EMAIL } from '../config';
import { useAsync } from '../utils/useAsync';

/** Shown on a suspended event's manage page: the admin's reason (from the event's activity) and who to contact to get it fixed. */
export function EventSuspendedNotice({ eventId }: { eventId: string }) {
  const reason = useAsync(async () => {
    const page = await eventApi.activity(eventId, { size: 50 }).catch(() => null);
    return page?.content.find((e) => e.action === 'moderation.suspend')?.details?.reason ?? null;
  }, [eventId]).data;
  return (
    <div className="alert alert-warning" role="alert">
      <strong>An admin suspended this event.</strong> It is hidden from the public and nothing can be bought until it is reinstated.
      {reason && (
        <>
          {' '}
          Reason: {reason}
        </>
      )}{' '}
      To fix this, contact the admin
      {CONTACT_EMAIL && (
        <>
          {' '}
          at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </>
      )}
      .
    </div>
  );
}
