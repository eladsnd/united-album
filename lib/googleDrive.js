import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
        scopes: SCOPES,
    });
    return google.drive({ version: 'v3', auth });
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
            body: fileBuffer,
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return response.data;
    } catch (error) {
        console.error('Drive upload error:', error);
        throw error;
    }
}
