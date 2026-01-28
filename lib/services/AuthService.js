/**
 * Authentication Service (Service Layer)
 *
 * Handles authentication business logic including login, registration, and user management.
 * Orchestrates UserRepository, password hashing, and JWT token generation.
 *
 * Pattern: Service layer pattern
 *
 * Usage:
 * ```javascript
 * const authService = new AuthService();
 *
 * // Login
 * const { token, user } = await authService.login('admin@example.com', 'password123');
 *
 * // Create user
 * const result = await authService.createUser('user@example.com', 'password123', 'EVENT_ADMIN', 'John Doe');
 *
 * // Assign event admin
 * await authService.assignEventAdmin(userId, eventId);
 * ```
 */

import { UserRepository } from '../repositories/UserRepository.js';
import { hashPassword, verifyPassword } from '../auth/passwordHash.js';
import { generateToken } from '../auth/sessionManager.js';

export class AuthService {
  constructor() {
    this.userRepo = new UserRepository();
  }

  /**
   * Authenticate user with email and password
   *
   * @param {string} email - User email
   * @param {string} password - Plain-text password
   * @returns {Promise<{token: string, user: Object}>} JWT token and user data
   * @throws {Error} If credentials are invalid
   *
   * @example
   * try {
   *   const { token, user } = await authService.login('admin@example.com', 'password123');
   *   console.log('Login successful:', user.email);
   *   // Store token in client
   * } catch (error) {
   *   console.error('Login failed:', error.message);
   * }
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    console.log(`[AuthService] Login attempt for: ${email}`);

    // Find user by email
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      console.log(`[AuthService] User not found: ${email}`);
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      console.log(`[AuthService] Invalid password for: ${email}`);
      throw new Error('Invalid credentials');
    }

    console.log(`[AuthService] Login successful: ${email} (${user.role})`);

    // Generate JWT token
    const token = generateToken(user);

    // Return token and user info (without password)
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      token,
      user: userWithoutPassword,
    };
  }

  /**
   * Create a new user
   *
   * @param {string} email - User email
   * @param {string} password - Plain-text password (will be hashed)
   * @param {string} role - User role (SUPER_ADMIN, EVENT_ADMIN, GUEST)
   * @param {string} [name] - Optional display name
   * @returns {Promise<{token: string, user: Object}>} JWT token and user data
   * @throws {Error} If user creation fails or email exists
   *
   * @example
   * const { token, user } = await authService.createUser(
   *   'admin@example.com',
   *   'securePassword123',
   *   'SUPER_ADMIN',
   *   'Super Admin'
   * );
   */
  async createUser(email, password, role = 'GUEST', name = null) {
    if (!email || !password || !role) {
      throw new Error('Email, password, and role are required');
    }

    console.log(`[AuthService] Creating user: ${email} (${role})`);

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    try {
      const user = await this.userRepo.create({
        email,
        passwordHash,
        role,
        name,
      });

      console.log(`[AuthService] User created successfully: ${user.id}`);

      // Generate JWT token for immediate login
      const token = generateToken(user);

      return {
        token,
        user,
      };
    } catch (error) {
      if (error.message.includes('Email already exists')) {
        throw new Error('Email already exists');
      }

      console.error('[AuthService] User creation failed:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Assign user as admin of an event
   *
   * @param {string} userId - User ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} EventAdmin record
   * @throws {Error} If assignment fails or user already assigned
   *
   * @example
   * await authService.assignEventAdmin(userId, eventId);
   * console.log('User assigned as event admin');
   */
  async assignEventAdmin(userId, eventId) {
    if (!userId || !eventId) {
      throw new Error('UserId and eventId are required');
    }

    console.log(`[AuthService] Assigning user ${userId} to event ${eventId}`);

    try {
      const eventAdmin = await this.userRepo.assignToEvent(userId, eventId);
      console.log(`[AuthService] Assignment successful`);
      return eventAdmin;
    } catch (error) {
      if (error.message.includes('already assigned')) {
        throw new Error('User is already assigned to this event');
      }

      console.error('[AuthService] Assignment failed:', error);
      throw new Error('Failed to assign event admin');
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
   * await authService.removeEventAdmin(userId, eventId);
   */
  async removeEventAdmin(userId, eventId) {
    if (!userId || !eventId) {
      throw new Error('UserId and eventId are required');
    }

    console.log(`[AuthService] Removing user ${userId} from event ${eventId}`);

    try {
      await this.userRepo.removeFromEvent(userId, eventId);
      console.log(`[AuthService] Removal successful`);
    } catch (error) {
      console.error('[AuthService] Removal failed:', error);
      throw new Error('Failed to remove event admin');
    }
  }

  /**
   * Get all users with optional role filtering
   *
   * @param {Object} [options] - Query options
   * @param {string} [options.role] - Filter by role
   * @returns {Promise<Array>} List of users (without passwords)
   *
   * @example
   * const eventAdmins = await authService.getAllUsers({ role: 'EVENT_ADMIN' });
   */
  async getAllUsers(options = {}) {
    try {
      const users = await this.userRepo.getAllUsers(options);
      return users;
    } catch (error) {
      console.error('[AuthService] Failed to fetch users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Get event admins for a specific event
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<Array>} List of users who are admins of this event
   *
   * @example
   * const admins = await authService.getEventAdmins(eventId);
   */
  async getEventAdmins(eventId) {
    if (!eventId) {
      throw new Error('EventId is required');
    }

    try {
      const admins = await this.userRepo.getEventAdmins(eventId);
      return admins;
    } catch (error) {
      console.error('[AuthService] Failed to fetch event admins:', error);
      throw new Error('Failed to fetch event admins');
    }
  }

  /**
   * Update user password
   *
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password for verification
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Updated user
   * @throws {Error} If current password is incorrect
   *
   * @example
   * await authService.updatePassword(userId, 'oldPass123', 'newPass456');
   */
  async updatePassword(userId, currentPassword, newPassword) {
    if (!userId || !currentPassword || !newPassword) {
      throw new Error('UserId, current password, and new password are required');
    }

    console.log(`[AuthService] Password update request for user: ${userId}`);

    // Fetch user
    const user = await this.userRepo.findUnique({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      console.log(`[AuthService] Invalid current password`);
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const updated = await this.userRepo.updatePassword(userId, newPasswordHash);
    console.log(`[AuthService] Password updated successfully`);

    return updated;
  }

  /**
   * Delete user
   *
   * @param {string} userId - User ID to delete
   * @returns {Promise<void>}
   *
   * @example
   * await authService.deleteUser(userId);
   */
  async deleteUser(userId) {
    if (!userId) {
      throw new Error('UserId is required');
    }

    console.log(`[AuthService] Deleting user: ${userId}`);

    try {
      await this.userRepo.deleteUser(userId);
      console.log(`[AuthService] User deleted successfully`);
    } catch (error) {
      console.error('[AuthService] User deletion failed:', error);
      throw new Error('Failed to delete user');
    }
  }
}
