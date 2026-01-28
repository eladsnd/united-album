/**
 * User Repository (Repository Pattern)
 *
 * Handles all database operations for User model.
 * Provides methods for authentication, user management, and event assignment.
 *
 * Pattern: Repository pattern extending BaseRepository
 *
 * Usage:
 * ```javascript
 * const userRepo = new UserRepository();
 * const user = await userRepo.findByEmail('admin@example.com');
 * const newUser = await userRepo.create({ email, passwordHash, role, name });
 * await userRepo.assignToEvent(userId, eventId);
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class UserRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'user'
   */
  getModel() {
    return 'user';
  }

  /**
   * Find user by email (unique lookup)
   *
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null
   *
   * @example
   * const user = await userRepo.findByEmail('admin@example.com');
   * if (user) {
   *   console.log('User found:', user.name);
   * }
   */
  async findByEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    try {
      const user = await this.findUnique({ email: email.toLowerCase() });
      return user;
    } catch (error) {
      console.error(`[UserRepository] Error finding user by email:`, error);
      throw error;
    }
  }

  /**
   * Create a new user
   *
   * @param {Object} data - User data
   * @param {string} data.email - User email (will be lowercased)
   * @param {string} data.passwordHash - Bcrypt password hash
   * @param {string} data.role - User role (SUPER_ADMIN, EVENT_ADMIN, GUEST)
   * @param {string} [data.name] - Optional display name
   * @returns {Promise<Object>} Created user (without passwordHash)
   *
   * @example
   * const user = await userRepo.create({
   *   email: 'admin@example.com',
   *   passwordHash: await hashPassword('password123'),
   *   role: 'SUPER_ADMIN',
   *   name: 'Admin User'
   * });
   */
  async create(data) {
    const { email, passwordHash, role, name } = data;

    if (!email || !passwordHash || !role) {
      throw new Error('Email, passwordHash, and role are required');
    }

    try {
      const user = await super.create({
        email: email.toLowerCase(),
        passwordHash,
        role,
        name: name || null,
      });

      // Remove sensitive data before returning
      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      // Check for unique constraint violation (email already exists)
      if (error.code === 'P2002') {
        throw new Error('Email already exists');
      }

      console.error(`[UserRepository] Error creating user:`, error);
      throw error;
    }
  }

  /**
   * Update user (excluding password)
   *
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.name] - Display name
   * @param {string} [updates.role] - User role
   * @returns {Promise<Object>} Updated user
   *
   * @example
   * const user = await userRepo.updateUser(userId, { name: 'New Name', role: 'EVENT_ADMIN' });
   */
  async updateUser(userId, updates) {
    try {
      const updated = await this.update({ id: userId }, updates);
      const { passwordHash: _, ...userWithoutPassword } = updated;
      return userWithoutPassword;
    } catch (error) {
      console.error(`[UserRepository] Error updating user:`, error);
      throw error;
    }
  }

  /**
   * Update user password
   *
   * @param {string} userId - User ID
   * @param {string} newPasswordHash - New bcrypt password hash
   * @returns {Promise<Object>} Updated user
   *
   * @example
   * const newHash = await hashPassword('newPassword123');
   * await userRepo.updatePassword(userId, newHash);
   */
  async updatePassword(userId, newPasswordHash) {
    try {
      const updated = await this.update(
        { id: userId },
        { passwordHash: newPasswordHash }
      );

      const { passwordHash: _, ...userWithoutPassword } = updated;
      return userWithoutPassword;
    } catch (error) {
      console.error(`[UserRepository] Error updating password:`, error);
      throw error;
    }
  }

  /**
   * Assign user as admin of an event
   *
   * @param {string} userId - User ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} EventAdmin record
   *
   * @example
   * await userRepo.assignToEvent(userId, eventId);
   * console.log('User assigned as event admin');
   */
  async assignToEvent(userId, eventId) {
    try {
      const eventAdmin = await this.prisma.eventAdmin.create({
        data: {
          userId,
          eventId,
          role: 'admin',
        },
      });

      console.log(`[UserRepository] User ${userId} assigned to event ${eventId}`);
      return eventAdmin;
    } catch (error) {
      // Check for unique constraint violation (already assigned)
      if (error.code === 'P2002') {
        throw new Error('User is already assigned to this event');
      }

      console.error(`[UserRepository] Error assigning user to event:`, error);
      throw error;
    }
  }

  /**
   * Remove user from event
   *
   * @param {string} userId - User ID
   * @param {string} eventId - Event ID
   * @returns {Promise<void>}
   *
   * @example
   * await userRepo.removeFromEvent(userId, eventId);
   * console.log('User removed from event');
   */
  async removeFromEvent(userId, eventId) {
    try {
      await this.prisma.eventAdmin.delete({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      console.log(`[UserRepository] User ${userId} removed from event ${eventId}`);
    } catch (error) {
      // Ignore if record doesn't exist
      if (error.code === 'P2025') {
        console.log(`[UserRepository] EventAdmin record not found (already removed)`);
        return;
      }

      console.error(`[UserRepository] Error removing user from event:`, error);
      throw error;
    }
  }

  /**
   * Get event admins for a specific event
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<Array>} List of users who are admins of this event
   *
   * @example
   * const admins = await userRepo.getEventAdmins(eventId);
   * console.log(`Event has ${admins.length} admins`);
   */
  async getEventAdmins(eventId) {
    try {
      const eventAdmins = await this.prisma.eventAdmin.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      return eventAdmins.map(ea => ea.user);
    } catch (error) {
      console.error(`[UserRepository] Error fetching event admins:`, error);
      throw error;
    }
  }

  /**
   * Get all users with optional role filtering
   *
   * @param {Object} [options] - Query options
   * @param {string} [options.role] - Filter by role
   * @returns {Promise<Array>} List of users (without passwordHash)
   *
   * @example
   * const admins = await userRepo.getAllUsers({ role: 'EVENT_ADMIN' });
   */
  async getAllUsers(options = {}) {
    try {
      const users = await this.findMany({
        where: options.role ? { role: options.role } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      // Remove password hashes
      return users.map(({ passwordHash, ...user }) => user);
    } catch (error) {
      console.error(`[UserRepository] Error fetching users:`, error);
      throw error;
    }
  }

  /**
   * Delete user
   *
   * @param {string} userId - User ID to delete
   * @returns {Promise<void>}
   *
   * @example
   * await userRepo.deleteUser(userId);
   */
  async deleteUser(userId) {
    try {
      await this.delete({ id: userId });
      console.log(`[UserRepository] User ${userId} deleted`);
    } catch (error) {
      console.error(`[UserRepository] Error deleting user:`, error);
      throw error;
    }
  }
}
