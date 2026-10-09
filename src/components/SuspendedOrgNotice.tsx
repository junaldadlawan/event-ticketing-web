import { organizationApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { CONTACT_EMAIL } from '../config';
import { useAsync } from '../utils/useAsync';

/**
 * Tells an organization's owner / members that it is suspended (shown on the manage pages). Admins don't see it:
 * they suspend organizations and have the Organizations tab. Anyone who may not read an organization just gets nothing.
 */
export function SuspendedOrgNotice({ organizationIds }: { organizationIds: string[] }) {
  const { user } = useAuth();
  const key = [...new Set(organizationIds)].sort().join(',');
  const suspended = useAsync(
    async () => {
      if (user?.role === 'ADMIN') return [];
      // The user's own organizations (finds one with no events yet), plus the ones behind the events on screen.
      const mine = await organizationApi.mine().catch(() => []);
      const known = new Set(mine.map((o) => o.id));
      const extra = await Promise.all(
        key.split(',').filter((id) => id && !known.has(id)).map((id) => organizationApi.get(id).catch(() => null)),
      );
      const all = [...mine, ...extra].filter((o) => o !== null);
      return all.filter((o) => o.status === 'SUSPENDED').map((o) => o.name);
    },
    [key, user?.role],
  );

  return (
    <>
      {(suspended.data ?? []).map((name) => (
        <div key={name} className="alert alert-warning" role="alert">
          <strong>{name} is suspended.</strong> You can&apos;t create or publish events for it until it is reinstated.
          {CONTACT_EMAIL && (
            <>
              {' '}
              Questions? <a href={`mailto:${CONTACT_EMAIL}`}>Contact support</a>.
            </>
          )}
        </div>
      ))}
    </>
  );
}
