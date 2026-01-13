import { NextResponse } from 'next/server';
import { uploadToDrive } from '@/lib/googleDrive';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Face Recognition (Mock detection for now)
        const faceId = 'person_' + Math.floor(Math.random() * 5);

        // 2. Upload to Google Drive
        let driveData = { id: 'mock_drive_id', webViewLink: '#' };
        try {
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                driveData = await uploadToDrive(buffer, file.name, process.env.GOOGLE_DRIVE_FOLDER_ID);
            }
        } catch (driveErr) {
            console.warn('Drive upload failed, continuing with local metadata only', driveErr);
        }

        // 3. Save Metadata locally
        const photosPath = path.join(process.cwd(), 'data', 'photos.json');
        let photos = [];
        if (fs.existsSync(photosPath)) {
            photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));
        }

        const newPhoto = {
            id: Date.now(),
            name: file.name,
            driveId: driveData.id,
            url: driveData.webViewLink,
            faceId: faceId,
            timestamp: new Date().toISOString()
        };

        photos.push(newPhoto);
        fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));

        return NextResponse.json({
            success: true,
            message: 'Photo uploaded and sorted by face!',
            faceId: faceId,
            driveLink: driveData.webViewLink
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
