/**
 * Input Validation Utilities
 *
 * Provides validation functions for user inputs.
 * Security best practices:
 * - Email: Trim whitespace
 * - Password: NEVER trim (spaces are valid characters)
 * - Names: Trim whitespace
 */

/**
 * Validate and sanitize email address
 *
 * @param {string} email - Email to validate
 * @returns {string} Sanitized email (trimmed, lowercase)
 * @throws {Error} If email is invalid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }

  // Trim whitespace (common mistake)
  const trimmed = email.trim().toLowerCase();

  // Email regex: basic but covers most cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format. Example: admin@example.com');
  }

  // Check for common typos
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    throw new Error('Invalid email format');
  }

  return trimmed;
}

/**
 * Validate password strength
 *
 * IMPORTANT: Does NOT trim whitespace - spaces are valid password characters!
 *
 * @param {string} password - Password to validate
 * @throws {Error} If password is too weak
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }

  // Minimum length check
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Maximum length check (prevent DoS via bcrypt)
  if (password.length > 72) {
    throw new Error('Password must be less than 72 characters');
  }

  // Check for extremely weak passwords
  const weakPasswords = [
    'password',
    '12345678',
    '00000000',
    'qwerty12',
    'admin123',
    'password123',
  ];

  if (weakPasswords.includes(password.toLowerCase())) {
    throw new Error('Password is too weak. Please choose a stronger password.');
  }

  // No actual trimming or modification - return as-is
  return password;
}

/**
 * Validate and sanitize user name
 *
 * @param {string} name - Name to validate (optional)
 * @returns {string|null} Sanitized name or null
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // Max length check
  if (trimmed.length > 100) {
    throw new Error('Name must be less than 100 characters');
  }

  return trimmed;
}

/**
 * Validate user role
 *
 * @param {string} role - Role to validate
 * @returns {string} Validated role
 * @throws {Error} If role is invalid
 */
export function validateRole(role) {
  const validRoles = ['SUPER_ADMIN', 'EVENT_ADMIN', 'GUEST'];

  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  return role;
}

/**
 * Password strength checker (for UI feedback)
 *
 * @param {string} password - Password to check
 * @returns {Object} Strength info { score: 0-4, feedback: string }
 */
export function checkPasswordStrength(password) {
  if (!password) {
    return { score: 0, feedback: 'Enter a password' };
  }

  let score = 0;
  const feedback = [];

  // Length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Complexity
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  // Feedback
  if (password.length < 8) {
    feedback.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add special characters');
  }

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return {
    score,
    label: labels[score],
    feedback: feedback.join(', '),
  };
}
