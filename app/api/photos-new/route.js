/**
 * Example refactored API route using NestJS patterns
 * This demonstrates how to use the new service layer architecture
 *
 * Compare this to the old routes in /app/api to see the improvements
 */

import { NextResponse } from 'next/server';
import { getPhotoService } from '@/src/bootstrap';
import { withErrorHandler } from '@/src/interceptors/error.interceptor';
import { withLogging } from '@/src/interceptors/logging.interceptor';
import { PhotoFilterDto } from '@/src/dto/upload-photo.dto';
import { validateAndTransform } from '@/src/validators/dto-validator';

/**
 * GET /api/photos-new
 * Get photos with optional filtering
 *
 * Query parameters:
 * - faceId: Filter by face ID
 * - poseId: Filter by pose ID
 * - uploaderId: Filter by uploader
 */
async function getPhotosHandler(request) {
  const { searchParams } = new URL(request.url);

  // Validate query parameters using DTO
  const filters = await validateAndTransform(PhotoFilterDto, {
    faceId: searchParams.get('faceId'),
    poseId: searchParams.get('poseId'),
    uploaderId: searchParams.get('uploaderId'),
  });

  // Use service to get photos
  const photoService = getPhotoService();
  const photos = await photoService.getPhotos(filters);

  return NextResponse.json({
    success: true,
    count: photos.length,
    photos,
  });
}

// Export with interceptors for error handling and logging
export const GET = withLogging(withErrorHandler(getPhotosHandler));

/**
 * Benefits of this approach:
 *
 * 1. Separation of Concerns:
 *    - Route: handles HTTP request/response
 *    - DTO: validates input
 *    - Service: contains business logic
 *    - Repository: handles data access
 *
 * 2. Automatic Error Handling:
 *    - withErrorHandler catches all errors
 *    - Formats them consistently
 *    - Logs operational errors
 *
 * 3. Automatic Logging:
 *    - withLogging logs all requests/responses
 *    - Structured JSON format
 *    - Sanitizes sensitive headers
 *
 * 4. Type Safety & Validation:
 *    - DTO validates query parameters
 *    - Throws ValidationError if invalid
 *    - Clear error messages
 *
 * 5. Testability:
 *    - Easy to mock photoService
 *    - Can test handler in isolation
 *    - Can test service separately
 *
 * 6. Reusability:
 *    - photoService used across multiple routes
 *    - Interceptors reused everywhere
 *    - DTOs reused for validation
 */
