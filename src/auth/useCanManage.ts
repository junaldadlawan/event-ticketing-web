import { isAdmin as isAdminRole } from './roles';
import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { eventApi, organizationApi } from '../api/endpoints';
import type { OrganizationPermission, OrganizationRole, UUID } from '../api/types';
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
    if (isAdminRole(user.role)) {
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
    if (isAdminRole(user.role)) {
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

/**
 * Whether the signed-in user is an owner or organizer of `organizationId` themselves. Unlike `useCanManage`
 * there is no admin shortcut: an admin who is not a member of the organization gets false. Used for the
 * ticket types, which only the event's own organizers may add, edit, pause, reorder or delete.
 */
export function useIsOrgManager(organizationId: UUID | null | undefined): boolean {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(false);
    if (!user || !organizationId) return;
    let cancelled = false;
    canManageOrg(user.id, organizationId).then((ok) => !cancelled && setAllowed(ok));
    return () => {
      cancelled = true;
    };
  }, [user, organizationId]);

  return allowed;
}

// Per user + organization, per page load. Like the caches above, only decides what to show: the API enforces it.
const permissionCache = new Map<string, Promise<OrganizationPermission[]>>();

function myPermissions(userId: UUID, orgId: UUID): Promise<OrganizationPermission[]> {
  const key = `${userId}:${orgId}`;
  let result = permissionCache.get(key);
  if (!result) {
    result = organizationApi
      .myMembership(orgId)
      .then((m) => m.permissions ?? [])
      // Not a member (404): no permissions.
      .catch(() => []);
    permissionCache.set(key, result);
  }
  return result;
}

/** The permissions the user holds in any of their approved organizations. */
function anyOrgPermissions(userId: UUID): Promise<OrganizationPermission[]> {
  return organizationApi
    .mine()
    .then((orgs) => Promise.all(orgs.filter((o) => o.status === 'APPROVED').map((o) => myPermissions(userId, o.id))))
    .then((lists) => lists.flat())
    .catch(() => []);
}

/**
 * Whether the signed-in user holds `permission` in `organizationId` (BR-ORG-008), or in any of their organizations
 * with 'any'. Admins always do (their access is unchanged). False while checking or before the organization is known.
 */
export function useHasPermission(permission: OrganizationPermission, organizationId: UUID | 'any' | null | undefined): boolean {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(false);
    if (!user || !organizationId) return;
    if (isAdminRole(user.role)) return setAllowed(true);
    let cancelled = false;
    (organizationId === 'any' ? anyOrgPermissions(user.id) : myPermissions(user.id, organizationId)).then(
      (perms) => !cancelled && setAllowed(perms.includes(permission)),
    );
    return () => {
      cancelled = true;
    };
  }, [user, organizationId, permission]);

  return allowed;
}

// Per user, per page load: the user's best organization role ("Organization Owner" beats "Organizer").
const positionCache = new Map<UUID, Promise<string | null>>();

function orgPosition(userId: UUID): Promise<string | null> {
  let result = positionCache.get(userId);
  if (!result) {
    result = organizationApi
      .mine()
      .then((orgs) => Promise.all(orgs.filter((o) => o.status === 'APPROVED').map((o) => organizationApi.members(o.id).catch(() => []))))
      .then((lists) => {
        const roles = lists.flat().filter((m) => m.userId === userId).flatMap((m) => m.roles);
        return roles.includes('OWNER') ? 'Organization Owner' : roles.includes('ORGANIZER') ? 'Organizer' : null;
      })
      .catch(() => null);
    positionCache.set(userId, result);
  }
  return result;
}

/** What to call the management view for this user: "Super admin", "Admin", "Organization Owner" or "Organizer" (null while checking). */
export function usePosition(): string | null {
  const { user } = useAuth();
  const [position, setPosition] = useState<string | null>(null);

  useEffect(() => {
    setPosition(null);
    if (!user) return;
    if (user.role === 'SUPER_ADMIN') return setPosition('Super admin');
    if (user.role === 'ADMIN') return setPosition('Admin');
    let cancelled = false;
    orgPosition(user.id).then((p) => !cancelled && setPosition(p));
    return () => {
      cancelled = true;
    };
  }, [user]);

  return position;
}
