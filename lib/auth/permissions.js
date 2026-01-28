/**
 * Role-Based Access Control (RBAC)
 *
 * Provides permission checking functions for multi-tenancy.
 * Implements hierarchical permissions: SUPER_ADMIN > EVENT_ADMIN > GUEST
 *
 * Pattern: Strategy pattern for role-based authorization
 *
 * Usage:
 * ```javascript
 * import { isSuperAdmin, canAccessEvent, getUserEvents } from '@/lib/auth/permissions';
 * import prisma from '@/lib/prisma';
 *
 * // Check if user is super admin
 * if (!isSuperAdmin(user)) {
 *   return res.status(403).json({ error: 'Forbidden' });
 * }
 *
 * // Check if user can access specific event
 * const canAccess = await canAccessEvent(user, eventId, prisma);
 * if (!canAccess) {
 *   return res.status(403).json({ error: 'Forbidden' });
 * }
 * ```
 */

import prisma from '../prisma.js';

/**
 * User roles (enum values from Prisma schema)
 */
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN', // Can create events, manage all admins
  EVENT_ADMIN: 'EVENT_ADMIN', // Can manage assigned event
  GUEST: 'GUEST',             // Can view/upload photos
};

/**
 * Check if user has super admin role
 *
 * @param {Object} user - User payload from JWT
 * @param {string} user.role - User role
 * @returns {boolean} True if super admin
 *
 * @example
 * if (isSuperAdmin(user)) {
 *   console.log('User has full access to all events');
 * }
 */
export function isSuperAdmin(user) {
  return user?.role === UserRole.SUPER_ADMIN;
}

/**
 * Check if user has event admin role
 *
 * @param {Object} user - User payload from JWT
 * @param {string} user.role - User role
 * @returns {boolean} True if event admin
 *
 * @example
 * if (isEventAdmin(user)) {
 *   console.log('User can manage their assigned events');
 * }
 */
export function isEventAdmin(user) {
  return user?.role === UserRole.EVENT_ADMIN;
}

/**
 * Check if user has any admin role (super or event)
 *
 * @param {Object} user - User payload from JWT
 * @returns {boolean} True if user is any type of admin
 *
 * @example
 * if (isAdmin(user)) {
 *   console.log('User has admin privileges');
 * }
 */
export function isAdmin(user) {
  return isSuperAdmin(user) || isEventAdmin(user);
}

/**
 * Check if user can access a specific event
 *
 * Permissions:
 * - SUPER_ADMIN: Can access all events
 * - EVENT_ADMIN: Can access only assigned events
 * - GUEST: Cannot access admin features
 *
 * @param {Object} user - User payload from JWT
 * @param {string} eventId - Event ID to check access for
 * @param {PrismaClient} [prismaClient=prisma] - Prisma client instance
 * @returns {Promise<boolean>} True if user can access event
 *
 * @example
 * const canAccess = await canAccessEvent(user, 'event-123');
 * if (!canAccess) {
 *   return res.status(403).json({ error: 'Access denied' });
 * }
 */
export async function canAccessEvent(user, eventId, prismaClient = prisma) {
  if (!user || !eventId) {
    return false;
  }

  // Super admins can access all events
  if (isSuperAdmin(user)) {
    return true;
  }

  // Event admins can only access their assigned events
  if (isEventAdmin(user)) {
    try {
      const eventAdmin = await prismaClient.eventAdmin.findUnique({
        where: {
          userId_eventId: {
            userId: user.userId,
            eventId: eventId,
          },
        },
      });

      return !!eventAdmin;
    } catch (error) {
      console.error('[permissions] Error checking event access:', error);
      return false;
    }
  }

  // Guests cannot access admin features
  return false;
}

/**
 * Get list of events user can access
 *
 * @param {Object} user - User payload from JWT
 * @param {PrismaClient} [prismaClient=prisma] - Prisma client instance
 * @returns {Promise<Array>} List of events user can access
 *
 * @example
 * const events = await getUserEvents(user);
 * console.log(`User can access ${events.length} events`);
 */
export async function getUserEvents(user, prismaClient = prisma) {
  if (!user) {
    return [];
  }

  try {
    // Super admin sees all active events
    if (isSuperAdmin(user)) {
      return await prismaClient.event.findMany({
        where: { isActive: true },
        orderBy: { startTime: 'desc' },
      });
    }

    // Event admin sees only assigned events
    if (isEventAdmin(user)) {
      const eventAdmins = await prismaClient.eventAdmin.findMany({
        where: { userId: user.userId },
        include: { event: true },
      });

      return eventAdmins
        .map(ea => ea.event)
        .filter(event => event.isActive);
    }

    // Guests have no events
    return [];
  } catch (error) {
    console.error('[permissions] Error fetching user events:', error);
    return [];
  }
}

/**
 * Check if user can create events
 *
 * @param {Object} user - User payload from JWT
 * @returns {boolean} True if user can create events
 *
 * @example
 * if (canCreateEvents(user)) {
 *   console.log('User can create new events');
 * }
 */
export function canCreateEvents(user) {
  return isSuperAdmin(user);
}

/**
 * Check if user can manage other users
 *
 * @param {Object} user - User payload from JWT
 * @returns {boolean} True if user can manage users
 *
 * @example
 * if (canManageUsers(user)) {
 *   console.log('User can create/edit/delete users');
 * }
 */
export function canManageUsers(user) {
  return isSuperAdmin(user);
}

/**
 * Check if user can assign event admins
 *
 * @param {Object} user - User payload from JWT
 * @returns {boolean} True if user can assign admins to events
 *
 * @example
 * if (canAssignEventAdmins(user)) {
 *   console.log('User can assign other users as event admins');
 * }
 */
export function canAssignEventAdmins(user) {
  return isSuperAdmin(user);
}
