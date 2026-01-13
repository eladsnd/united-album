import { detectFace } from '../../../utils/faceDetection';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const folderId = formData.get('folderId') || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const poseId = formData.get('poseId') || 'unknown_pose';

        if (!file) {
            console.error('[Upload API] No file found in request');
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log(`[Upload API] Processing upload for file: ${file.name}, pose: ${poseId}, target folder: ${folderId}`);

        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Face Recognition using face-api.js
        console.log('[Upload API] Running face detection...');
        const faceId = await detectFace(buffer);
        console.log(`[Upload API] Face detected: ${faceId}`);

        // 2. Upload to Google Drive
        let driveData = { id: 'mock_drive_id', webViewLink: '/challenges/dip.png' };

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
            console.error('[Upload API] OAuth 2.0 credentials missing. Rejecting upload.');
            return NextResponse.json({
                error: 'Google Drive OAuth configuration missing. Please check your .env.local file.',
                code: 'CREDENTIALS_MISSING'
            }, { status: 403 });
        }

        try {
            console.log(`[Upload API] Uploading to Google Drive folder: ${folderId}`);
            driveData = await uploadToDrive(buffer, file.name, folderId);
            console.log(`[Upload API] Drive upload successful. ID: ${driveData.id}`);
        } catch (driveErr) {
            console.error('[Upload API] Drive upload failed:', driveErr.message);
            return NextResponse.json({
                error: 'Drive upload failed: ' + driveErr.message,
                code: 'DRIVE_UPLOAD_FAILED'
            }, { status: 500 });
        }

        // 3. Save Metadata locally using our utility
        // Construct local proxy URL instead of a direct Google Drive link
        const proxyImageUrl = `/api/image/${driveData.id}`;

        const newPhoto = {
            id: Date.now(),
            name: file.name,
            driveId: driveData.id,
            url: proxyImageUrl,
            faceId: faceId,
            poseId: poseId,
            timestamp: new Date().toISOString()
        };

        try {
            savePhoto(newPhoto);
            console.log('[Upload API] Local metadata saved successfully');
        } catch (saveErr) {
            console.error('[Upload API] Failed to save local metadata:', saveErr.message);
            throw saveErr; // This is critical
        }

        return NextResponse.json({
            success: true,
            message: 'Photo uploaded and sorted by pose!',
            faceId: faceId,
            driveLink: proxyImageUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
