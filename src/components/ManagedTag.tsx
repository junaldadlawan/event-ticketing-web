import type { UUID } from '../api/types';
import { useManagementHidden } from '../auth/ViewMode';
import { useCanManage } from '../auth/useCanManage';
import { EditIcon } from './DesignerIcons';

/**
 * "You manage" tag for event cards, shown only when the signed-in user can
 * manage the event's organization (owner/organizer, or admin). The check is
 * cached per organization, so a list of events costs one request per org.
 */
export function ManagedTag({ organizationId }: { organizationId: UUID }) {
  const canManage = useCanManage(organizationId);
  const hidden = useManagementHidden(); // browsing as a customer
  if (!canManage || hidden) return null;
  return (
    <span className="managed-tag" title="You manage this event - open it and use Manage to edit">
      <EditIcon />
      You manage
    </span>
  );
}
