import { NextResponse } from 'next/server';
import { getPhotoService } from '@/src/bootstrap';
import { withErrorHandler } from '@/src/interceptors/error.interceptor';
import { withLogging } from '@/src/interceptors/logging.interceptor';
import { validateAndTransform, validateFile } from '@/src/validators/dto-validator';
import { UploadPhotoDto } from '@/src/dto/upload-photo.dto';
import { applyRateLimit } from '../../../lib/rateLimit';
import { AppError } from '@/src/errors/app-error';

/**
 * POST /api/upload
 * Upload a photo to Google Drive and save metadata
 *
 * Refactored to use NestJS-style architecture:
 * - DTOs for validation
 * - Service layer for business logic
 * - Error interceptor for consistent error handling
 * - Logging interceptor for structured logging
 */
async function uploadHandler(request) {
    // Apply rate limiting (10 uploads per minute per IP)
    const rateLimitResult = applyRateLimit(request, 'upload');
    if (!rateLimitResult.allowed) {
        return rateLimitResult.response;
    }

    const formData = await request.formData();
    const file = formData.get('file');

    // Validate file
    if (!file) {
        throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    validateFile(file, {
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSize: 10 * 1024 * 1024, // 10MB
    });

    // Validate DTO
    const dto = await validateAndTransform(UploadPhotoDto, {
        file,
        folderId: formData.get('folderId') || process.env.GOOGLE_DRIVE_FOLDER_ID,
        poseId: formData.get('poseId') || 'unknown_pose',
        uploaderId: formData.get('uploaderId'),
    });

    // Check OAuth credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
        throw new AppError(
            'Google Drive OAuth configuration missing',
            403,
            'CREDENTIALS_MISSING'
        );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    dto.file = buffer;
    dto.fileName = file.name;

    // Use PhotoService for upload
    const photoService = getPhotoService();
    const photo = await photoService.uploadPhoto(dto);

    return NextResponse.json({ success: true, photo });
}

// Export with interceptors for error handling and logging
export const POST = withLogging(withErrorHandler(uploadHandler));
