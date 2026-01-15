import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function getDriveClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function uploadToDrive(fileBuffer, fileName, folderId) {
    try {
        const drive = await getDriveClient();
        const fileMetadata = {
            name: fileName,
            parents: folderId ? [folderId] : [],
        };
        const media = {
            mimeType: 'image/jpeg',
            body: Readable.from(fileBuffer),
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        // Make the file publicly viewable (anyone with link)
        try {
            await drive.permissions.create({
                fileId: response.data.id,
                resource: {
                    role: 'reader',
                    type: 'anyone',
                },
            });
        } catch (permError) {
            console.warn('Could not set file permissions:', permError.message);
            // We continue even if permissions fail, it might just mean the image won't show for others
        }

        return response.data;
    } catch (error) {
        console.error('Drive upload error:', error.message);
        throw error;
    }
}
export async function listDriveFiles(folderId) {
    try {
        const drive = await getDriveClient();
        const query = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';

        const response = await drive.files.list({
            q: query,
            fields: 'files(id)',
            pageSize: 1000,
        });

        return new Set(response.data.files.map(file => file.id));
    } catch (error) {
        console.error('Drive list error:', error.message);
        throw error;
    }
}

export async function getFileStream(fileId) {
    try {
        const drive = await getDriveClient();
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        return {
            stream: response.data,
            contentType: response.headers['content-type'],
        };
    } catch (error) {
        console.error('Drive stream error:', error.message);
        throw error;
    }
}

/**
 * Create a folder in Google Drive
 * @param {string} folderName - Name of the folder to create
 * @param {string} parentFolderId - Parent folder ID (optional)
 * @returns {Promise<string>} - Created folder ID
 */
export async function createDriveFolder(folderName, parentFolderId) {
    try {
        const drive = await getDriveClient();
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentFolderId ? [parentFolderId] : [],
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });

        console.log(`[Google Drive] Created folder "${folderName}": ${response.data.id}`);
        return response.data.id;
    } catch (error) {
        console.error('Drive folder creation error:', error.message);
        throw error;
    }
}

/**
 * Find or create a subfolder within a parent folder
 * @param {string} folderName - Name of the folder to find/create
 * @param {string} parentFolderId - Parent folder ID
 * @returns {Promise<string>} - Folder ID
 */
export async function findOrCreateFolder(folderName, parentFolderId) {
    try {
        const drive = await getDriveClient();

        // Search for existing folder
        const query = `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            pageSize: 1,
        });

        if (response.data.files.length > 0) {
            console.log(`[Google Drive] Found existing folder "${folderName}": ${response.data.files[0].id}`);
            return response.data.files[0].id;
        }

        // Folder doesn't exist, create it
        return await createDriveFolder(folderName, parentFolderId);
    } catch (error) {
        console.error('Drive folder find/create error:', error.message);
        throw error;
    }
}

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteFromDrive(fileId) {
    try {
        const drive = await getDriveClient();
        await drive.files.delete({ fileId });
        console.log(`[Google Drive] Deleted file: ${fileId}`);
        return true;
    } catch (error) {
        console.error(`[Google Drive] Failed to delete file ${fileId}:`, error.message);
        throw error;
    }
}
