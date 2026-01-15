import { NextResponse } from 'next/server';
import { uploadToDrive } from '../../../lib/googleDrive';
import { savePhoto } from '../../../lib/photoStorage';
import { applyRateLimit } from '../../../lib/rateLimit';

export async function POST(request) {
    // Apply rate limiting (10 uploads per minute per IP)
    const rateLimitResult = applyRateLimit(request, 'upload');
    if (!rateLimitResult.allowed) {
        return rateLimitResult.response;
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const folderId = formData.get('folderId') || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const poseId = formData.get('poseId') || 'unknown_pose';
        const uploaderId = formData.get('uploaderId'); // Client-generated session ID

        // Note: Face detection now happens AFTER upload in the new flow
        // The client uploads the image first, then downloads it back, detects faces,
        // and calls /api/update-faces with the face data and thumbnails

        if (!file) {
            console.error('[Upload API] No file found in request');
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log(`[Upload API] Processing upload for file: ${file.name}, pose: ${poseId}`);

        const buffer = Buffer.from(await file.arrayBuffer());

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

            // Note: Thumbnails are now uploaded via /api/update-faces after face detection
            // This endpoint only uploads the main photo

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

        // In the new upload-first flow, face data is added later via /api/update-faces
        const newPhoto = {
            id: Date.now(),
            name: file.name,
            driveId: driveData.id,
            url: proxyImageUrl,
            mainFaceId: 'unknown', // Will be updated by /api/update-faces
            faceIds: [], // Will be updated by /api/update-faces
            faceBoxes: [], // Will be updated by /api/update-faces
            poseId: poseId,
            uploaderId: uploaderId || null, // Track who uploaded this photo
            timestamp: new Date().toISOString()
        };

        console.log('[Upload API] Saving photo metadata:', JSON.stringify(newPhoto, null, 2));

        try {
            const savedPhoto = savePhoto(newPhoto);
            console.log(`[Upload API] Photo saved successfully: ${savedPhoto.id}`);
            return NextResponse.json({ success: true, photo: savedPhoto });
        } catch (storageErr) {
            console.error('[Upload API] Failed to save photo metadata:', storageErr);
            // Attempt to cleanup drive file if metadata save fails?
            return NextResponse.json({
                error: 'Failed to save photo metadata: ' + storageErr.message,
                code: 'METADATA_SAVE_FAILED'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
