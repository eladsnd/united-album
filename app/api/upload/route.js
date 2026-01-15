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
        const mainFaceId = formData.get('mainFaceId') || 'unknown';
        const faceIdsStr = formData.get('faceIds') || 'unknown';
        const faceBoxesStr = formData.get('faceBoxes') || '[]';

        if (!file) {
            console.error('[Upload API] No file found in request');
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log(`[Upload API] Processing upload for file: ${file.name}, pose: ${poseId}, main face: ${mainFaceId}`);

        const buffer = Buffer.from(await file.arrayBuffer());

        // Face detection now happens client-side before upload
        console.log(`[Upload API] Using client-detected face IDs`);

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

        // Parse face IDs and boxes
        const faceIdArray = faceIdsStr.split(',').map(id => id.trim()).filter(id => id);
        let faceBoxes = [];
        try {
            faceBoxes = JSON.parse(faceBoxesStr);
        } catch (e) {
            console.warn('[Upload API] Failed to parse face boxes:', e);
        }

        const newPhoto = {
            id: Date.now(),
            name: file.name,
            driveId: driveData.id,
            url: proxyImageUrl,
            mainFaceId: mainFaceId, // Primary face for filtering/grouping
            faceIds: faceIdArray, // All faces in the photo
            faceBoxes: faceBoxes, // Bounding boxes for face cropping
            poseId: poseId,
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
