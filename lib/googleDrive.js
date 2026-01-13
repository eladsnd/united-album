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

        return response.data;
    } catch (error) {
        console.error('Drive upload error:', error.message);
        throw error;
    }
}
