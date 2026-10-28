import { organizationApi } from '../api/endpoints';
import { useAsync } from '../utils/useAsync';

/** The organization(s) the signed-in owner or organizer works for, shown in the middle of the top bar of their management view. */
export function HeaderOrgName() {
  const names = useAsync(async () => (await organizationApi.mine()).filter((o) => o.status === 'APPROVED').map((o) => o.name), []).data ?? [];
  if (names.length === 0) return null;
  return (
    <p className="topbar-org" title={names.join(', ')}>
      {names.join(' · ')}
    </p>
  );
}
