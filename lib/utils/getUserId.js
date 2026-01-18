/**
 * Generate or retrieve a persistent user ID for the current browser
 *
 * This creates a unique identifier that persists across page reloads
 * but is specific to this browser. Used for tracking photo likes.
 */

export function getUserId() {
    if (typeof window === 'undefined') return null;

    const STORAGE_KEY = 'user_id';

    // Try to get existing ID from localStorage
    let userId = localStorage.getItem(STORAGE_KEY);

    if (!userId) {
        // Generate a new unique ID: user_{timestamp}_{random}
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        userId = `user_${timestamp}_${random}`;

        // Store it for future use
        localStorage.setItem(STORAGE_KEY, userId);
    }

    return userId;
}
