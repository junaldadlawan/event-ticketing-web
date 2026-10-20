import { useState } from 'react';
import { activityApi, organizationApi } from '../api/endpoints';
import type { ActivityArea } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/roles';
import { useAsync } from '../utils/useAsync';
import { ActivityList } from './EventActivity';
import { FormDialog } from './FormDialog';

/** Organization logs only the owner may read (BR-ADMIN-007); the other areas are open to organizers too. */
const OWNER_ONLY: ActivityArea[] = ['FINANCE'];

type Org = { id: string; name: string };

/**
 * "Logs" on a management tab: who changed what in this area, newest first, in a window. `organizations` scopes it to
 * an organization (the owner's / organizer's tabs; a picker shows when there are several); without it, it is the
 * platform's log, for admins. The button only shows to people allowed to read that log.
 */
export function LogsButton({ area, title, organizations }: { area: ActivityArea; title: string; organizations?: Org[] | 'mine' }) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [open, setOpen] = useState(false);
  const [orgChoice, setOrgChoice] = useState('');

  // The organizations whose log in this area the user may read.
  const readable = useAsync(async (): Promise<Org[]> => {
    if (!organizations || !user) return [];
    const orgs =
      organizations === 'mine'
        ? (await organizationApi.mine())
            .filter((o) => o.status === 'APPROVED' || o.status === 'SUSPENDED')
            .map(({ id, name }) => ({ id, name }))
        : organizations.filter((o) => o.id);
    if (admin) return orgs;
    const needed = OWNER_ONLY.includes(area) ? ['OWNER'] : ['OWNER', 'ORGANIZER'];
    const allowed = await Promise.all(
      orgs.map(async (o) => {
        const me = (await organizationApi.members(o.id)).find((m) => m.userId === user.id);
        return me?.roles.some((r) => needed.includes(r)) ? o : null;
      }),
    );
    return allowed.filter((o): o is Org => o !== null);
  }, [user?.id, admin, area, organizations === 'mine' ? 'mine' : (organizations ?? []).map((o) => o.id).join(',')]);

  const platform = !organizations;
  if (platform ? !admin : !readable.data?.length) return null;

  const orgId = platform ? undefined : (readable.data!.find((o) => o.id === orgChoice) ?? readable.data![0]).id;
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} title={`Who changed what in ${title.toLowerCase()}, and when`}>
        Logs
      </button>
      <FormDialog open={open} title={`${title} logs`} onClose={() => setOpen(false)}>
        {!platform && readable.data!.length > 1 && (
          <select className="select-auto" value={orgId} onChange={(e) => setOrgChoice(e.target.value)} aria-label="Organization">
            {readable.data!.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <ActivityList
          key={`${area}|${orgId ?? 'platform'}`}
          load={(page, size) => activityApi.list({ area, organizationId: orgId, page, size })}
          showEventTitle={area === 'EVENTS'}
        />
      </FormDialog>
    </>
  );
}
