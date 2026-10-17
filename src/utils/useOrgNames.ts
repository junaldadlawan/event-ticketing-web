import { organizationApi } from '../api/endpoints';
import { useAsync } from './useAsync';

/**
 * Organization id -> name: the user's own organizations (even ones with no events yet), plus the organizations behind
 * the given ids (an event on screen). Pending and rejected applications are not "managed", so they are left out.
 */
export function useOrgNames(ids: string[]): Map<string, string> {
  const key = [...new Set(ids)].sort().join(',');
  const { data } = useAsync(async () => {
    const names = new Map<string, string>();
    for (const o of await organizationApi.mine().catch(() => [])) {
      if (o.status === 'APPROVED' || o.status === 'SUSPENDED') names.set(o.id, o.name);
    }
    const rest = key.split(',').filter((id) => id && !names.has(id));
    for (const o of await Promise.all(rest.map((id) => organizationApi.get(id).catch(() => null)))) {
      if (o) names.set(o.id, o.name);
    }
    return names;
  }, [key]);
  return data ?? new Map();
}
