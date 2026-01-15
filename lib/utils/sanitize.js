/**
 * Input sanitization utilities to prevent security vulnerabilities
 */

/**
 * Sanitize filename to prevent path traversal and special character exploits
 * @param {string} fileName - Raw filename from user input
 * @returns {string} - Sanitized filename safe for file system operations
 */
export function sanitizeFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return 'untitled';
    }

    return fileName
        .replace(/[^a-zA-Z0-9._-]/g, '-') // Replace special chars with dash
        .replace(/\.{2,}/g, '.') // Prevent directory traversal (..)
        .replace(/^\.+/, '') // Remove leading dots
        .replace(/-+/g, '-') // Collapse multiple dashes
        .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
        .slice(0, 255); // Limit to reasonable length
}

/**
 * Validate and sanitize Google Drive ID
 * @param {string} driveId - Google Drive file/folder ID
 * @returns {string} - Validated Drive ID
 * @throws {Error} - If Drive ID format is invalid
 */
export function sanitizeDriveId(driveId) {
    if (!driveId || typeof driveId !== 'string') {
        throw new Error('Drive ID is required');
    }

    // Google Drive IDs are alphanumeric with dashes/underscores, typically 20-50 chars
    if (!/^[a-zA-Z0-9_-]{15,60}$/.test(driveId)) {
        throw new Error('Invalid Drive ID format');
    }

    return driveId;
}

/**
 * Sanitize pose/challenge ID
 * @param {string} poseId - Pose identifier
 * @returns {string} - Sanitized pose ID
 */
export function sanitizePoseId(poseId) {
    if (!poseId || typeof poseId !== 'string') {
        return '';
    }

    return poseId
        .trim()
        .replace(/[<>\"']/g, '') // Remove potential XSS chars
        .slice(0, 100); // Reasonable limit
}

/**
 * Sanitize uploader ID
 * @param {string} uploaderId - Uploader session ID
 * @returns {string} - Sanitized uploader ID
 * @throws {Error} - If uploader ID format is invalid
 */
export function sanitizeUploaderId(uploaderId) {
    if (!uploaderId || typeof uploaderId !== 'string') {
        throw new Error('Uploader ID is required');
    }

    // Format: uploader_<timestamp>_<random>
    if (!/^uploader_\d+_[a-z0-9]{9}$/.test(uploaderId)) {
        throw new Error('Invalid uploader ID format');
    }

    return uploaderId;
}

/**
 * Sanitize face ID
 * @param {string} faceId - Face identifier
 * @returns {string} - Sanitized face ID
 * @throws {Error} - If face ID format is invalid
 */
export function sanitizeFaceId(faceId) {
    if (!faceId || typeof faceId !== 'string') {
        throw new Error('Face ID is required');
    }

    // Format: person_<number> or 'unknown'
    if (faceId !== 'unknown' && !/^person_\d+$/.test(faceId)) {
        throw new Error('Invalid face ID format');
    }

    return faceId;
}

/**
 * Sanitize photo ID
 * @param {number|string} photoId - Photo identifier
 * @returns {number} - Validated photo ID
 * @throws {Error} - If photo ID is invalid
 */
export function sanitizePhotoId(photoId) {
    const id = typeof photoId === 'string' ? parseInt(photoId, 10) : photoId;

    if (!Number.isInteger(id) || id < 0) {
        throw new Error('Invalid photo ID');
    }

    return id;
}
