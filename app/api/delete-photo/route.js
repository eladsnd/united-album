import { NextResponse } from 'next/server';
import { getPhotoService } from '@/src/bootstrap';
import { withErrorHandler } from '@/src/interceptors/error.interceptor';
import { withLogging } from '@/src/interceptors/logging.interceptor';
import { validateAndTransform } from '@/src/validators/dto-validator';
import { DeletePhotoDto } from '@/src/dto/upload-photo.dto';
import { isAdminAuthenticated } from '../../../lib/adminAuth';
import { applyRateLimit } from '../../../lib/rateLimit';
import { AppError } from '@/src/errors/app-error';

/**
 * DELETE /api/delete-photo?photoId=123&uploaderId=xxx
 * Delete a photo from the album AND Google Drive
 *
 * Security: Only the uploader can delete their own photos, OR admin can delete any photo
 * Rate limited to 10 deletes per minute to prevent deletion spam/DoS
 *
 * Refactored to use NestJS-style architecture:
 * - DTOs for validation
 * - Service layer for business logic
 * - Admin authentication check
 * - Automatic orphaned face cleanup
 */
async function deletePhotoHandler(request) {
    // CRITICAL SECURITY: Rate limit delete operations to prevent DoS
    const rateLimitResult = applyRateLimit(request, 'delete');

    if (!rateLimitResult.allowed) {
        throw new AppError(
            'Too many delete requests. Please slow down.',
            429,
            'RATE_LIMIT_EXCEEDED'
        );
    }

    const { searchParams } = new URL(request.url);

    // Check if user is admin
    const isAdmin = isAdminAuthenticated(request);

    // Validate DTO
    const dto = await validateAndTransform(DeletePhotoDto, {
        photoId: parseInt(searchParams.get('photoId')),
        uploaderId: searchParams.get('uploaderId'),
        isAdmin,
    });

    // Use PhotoService to delete photo
    const photoService = getPhotoService();
    const result = await photoService.deletePhoto(
        dto.photoId,
        dto.uploaderId,
        dto.isAdmin
    );

    const message = result.orphanedFaces.length > 0
        ? `Photo permanently deleted. ${result.orphanedFaces.length} orphaned face thumbnail(s) also removed.`
        : 'Photo permanently deleted from Drive and album.';

    return NextResponse.json({
        ...result,
        message,
    });
}

// Export with interceptors
export const DELETE = withLogging(withErrorHandler(deletePhotoHandler));
