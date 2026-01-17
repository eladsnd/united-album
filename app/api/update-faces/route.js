import { NextResponse } from 'next/server';
import { getPhotoService, getFaceService } from '@/src/bootstrap';
import { withErrorHandler } from '@/src/interceptors/error.interceptor';
import { withLogging } from '@/src/interceptors/logging.interceptor';
import { validateAndTransform } from '@/src/validators/dto-validator';
import { UpdatePhotoFacesDto } from '@/src/dto/upload-photo.dto';
import { AppError } from '@/src/errors/app-error';

/**
 * POST /api/update-faces
 * Update photo with face detection results and upload face thumbnails
 * Called after image is uploaded and faces are detected from the Drive version
 *
 * Refactored to use NestJS-style architecture
 */
async function updateFacesHandler(request) {
    const formData = await request.formData();

    // Validate photo ID with proper error handling
    const photoIdStr = formData.get('photoId');
    if (!photoIdStr) {
        throw new AppError('Photo ID is required', 400, 'PHOTO_ID_MISSING');
    }

    const photoId = parseInt(photoIdStr, 10);
    if (isNaN(photoId) || photoId <= 0) {
        throw new AppError(
            `Invalid photo ID: "${photoIdStr}". Must be a positive integer.`,
            400,
            'INVALID_PHOTO_ID'
        );
    }

    const driveId = formData.get('driveId');
    const faceIdsStr = formData.get('faceIds') || '';
    const mainFaceId = formData.get('mainFaceId') || 'unknown';
    const faceBoxesStr = formData.get('faceBoxes') || '[]';

    // Parse face IDs and boxes
    const faceIdArray = faceIdsStr.split(',').map(id => id.trim()).filter(id => id);
    let faceBoxes = [];
    try {
        faceBoxes = JSON.parse(faceBoxesStr);
    } catch (e) {
        console.warn('[Update Faces API] Failed to parse face boxes:', e);
        throw new AppError(
            'Invalid face boxes format. Must be valid JSON array.',
            400,
            'INVALID_FACE_BOXES'
        );
    }

    // Validate that face IDs and boxes arrays match in length
    if (faceIdArray.length > 0 && faceBoxes.length > 0 && faceIdArray.length !== faceBoxes.length) {
        throw new AppError(
            `Face data mismatch: ${faceIdArray.length} face IDs but ${faceBoxes.length} face boxes. Arrays must have equal length.`,
            400,
            'FACE_DATA_MISMATCH'
        );
    }

    // Extract face thumbnail blobs from FormData
    const faceThumbnailFiles = [];
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('faceThumbnail_')) {
            const faceId = key.replace('faceThumbnail_', '');
            faceThumbnailFiles.push({ faceId, file: value });
        }
    }

    // Convert thumbnail files to buffers
    const faceThumbnails = await Promise.all(
        faceThumbnailFiles.map(async ({ faceId, file }) => ({
            faceId,
            thumbnail: Buffer.from(await file.arrayBuffer()),
        }))
    );

    // Validate DTO
    const dto = await validateAndTransform(UpdatePhotoFacesDto, {
        faceIds: faceIdArray,
        mainFaceId,
        faceBoxes,
        faceThumbnails,
    });

    // Use PhotoService to update faces
    const photoService = getPhotoService();
    const updatedPhoto = await photoService.updatePhotoFaces(photoId, dto);

    return NextResponse.json({
        success: true,
        photo: updatedPhoto,
        thumbnailsUploaded: dto.faceThumbnails?.length || 0,
    });
}

// Export with interceptors
export const POST = withLogging(withErrorHandler(updateFacesHandler));
