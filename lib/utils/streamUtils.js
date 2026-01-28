/**
 * Stream Utilities
 *
 * Centralized utilities for handling Node.js streams properly.
 * Prevents code duplication and ensures consistent stream handling across the app.
 */

/**
 * Convert a Node.js readable stream to a Buffer
 *
 * Google Drive API returns streams that are NOT async iterable,
 * so we must use traditional event listeners.
 *
 * @param {ReadableStream} stream - Node.js readable stream
 * @returns {Promise<Buffer>} - Buffered stream data
 * @throws {Error} - If stream emits error event
 */
export async function streamToBuffer(stream) {
    const chunks = [];
    let totalBytes = 0;

    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
            chunks.push(chunk);
            totalBytes += chunk.length;
        });

        stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log(`[Stream Utils] Stream converted to buffer: ${totalBytes} bytes`);
            resolve(buffer);
        });

        stream.on('error', (err) => {
            console.error('[Stream Utils] Stream error:', err);
            reject(err);
        });
    });
}

/**
 * Download file from Google Drive and convert to Buffer
 *
 * Wraps getFileStream() + streamToBuffer() for convenience.
 *
 * @param {Function} getFileStream - Function that returns { stream } from Drive
 * @param {string} driveId - Google Drive file ID
 * @returns {Promise<Buffer>} - File contents as buffer
 */
export async function downloadDriveFile(getFileStream, driveId) {
    try {
        const response = await getFileStream(driveId);
        const stream = response.stream;
        const buffer = await streamToBuffer(stream);
        return buffer;
    } catch (error) {
        console.error(`[Stream Utils] Failed to download file ${driveId}:`, error);
        throw new Error(`Failed to download file: ${error.message}`);
    }
}
