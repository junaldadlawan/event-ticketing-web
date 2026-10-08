import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { eventApi, organizationApi } from '../api/endpoints';
import type { OrganizationRole, UUID } from '../api/types';
import { useAuth } from './AuthContext';

/** Roles that may edit an organization's events (matches the API's own rule). */
const MANAGING_ROLES: OrganizationRole[] = ['OWNER', 'ORGANIZER'];

// One lookup per user + organization per page load. Not a security boundary -
// the API enforces permissions on every edit; this only decides whether to
// show the Manage button.
const cache = new Map<string, Promise<boolean>>();

function canManageOrg(userId: UUID, orgId: UUID): Promise<boolean> {
  const key = `${userId}:${orgId}`;
  let result = cache.get(key);
  if (!result) {
    result = organizationApi
      .members(orgId)
      .then((members) => {
        const me = members.find((m) => m.userId === userId);
        return Boolean(me?.roles.some((r) => MANAGING_ROLES.includes(r)));
      })
      // Non-members get 403 here - that just means "no".
      .catch(() => false);
    cache.set(key, result);
  }
  return result;
}

// Per user, per page load.
const hostCache = new Map<UUID, Promise<boolean>>();

function hostsAnything(userId: UUID): Promise<boolean> {
  let result = hostCache.get(userId);
  if (!result) {
    // The API refuses the managed-events list (403) to anyone who isn't an
    // owner/organizer of some organization, which is exactly the question.
    // Any other failure also counts as "not a host": showing the banner is
    // the harmless default. A non-403 error isn't cached, so it's retried.
    result = eventApi
      .managed({ size: 1 })
      .then(() => true)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 403)) hostCache.delete(userId);
        return false;
      });
    hostCache.set(userId, result);
  }
  return result;
}

/**
 * Whether the signed-in user already hosts events: a platform admin, or an
 * owner/organizer of any organization. `null` while still checking.
 * Logged-out visitors count as "not a host" (false).
 */
export function useIsHost(): boolean | null {
  const { user, loading } = useAuth();
  const [isHost, setIsHost] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) {
      setIsHost(null);
      return;
    }
    if (!user) {
      setIsHost(false);
      return;
    }
    if (user.role === 'ADMIN') {
      setIsHost(true);
      return;
    }
    setIsHost(null);
    let cancelled = false;
    hostsAnything(user.id).then((h) => !cancelled && setIsHost(h));
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return isHost;
}

/**
 * Whether the signed-in user can manage events of `organizationId`:
 * a platform admin, or that organization's owner or organizer.
 */
export function useCanManage(organizationId: UUID | null | undefined): boolean {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(false);
    if (!user || !organizationId) return;
    if (user.role === 'ADMIN') {
      setAllowed(true);
      return;
    }
    let cancelled = false;
    canManageOrg(user.id, organizationId).then((ok) => !cancelled && setAllowed(ok));
    return () => {
      cancelled = true;
    };
  }, [user, organizationId]);

  return allowed;
}
