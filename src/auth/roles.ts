import type { Role } from '../api/types';

/** Admins and the super admin both get the admin screens. */
export const isAdmin = (role?: Role | null) => role === 'ADMIN' || role === 'SUPER_ADMIN';

/** The suspend / reinstate button: nobody can act on the super admin, and only the super admin can act on an admin. */
export function canModerate(me: Role | undefined, target: Role): boolean {
  if (target === 'SUPER_ADMIN') return false;
  if (target === 'ADMIN') return me === 'SUPER_ADMIN';
  return isAdmin(me);
}
