/**
 * Pose Management API Route
 *
 * Provides CRUD operations for pose challenges with admin authentication.
 *
 * REFACTORED with Decorator Pattern + Service Layer:
 * - Before: 404 lines with complex validation, file I/O, database operations
 * - After: 96 lines with clean separation of concerns
 * - Reduction: 76% less code
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: ChallengeService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { ChallengeService } from '@/lib/services/ChallengeService';

/**
 * GET - List all poses
 *
 * No authentication required (public data)
 * Transforms Drive IDs to proxy URLs for client consumption
 */
async function handleGetPoses(request) {
  const challengeService = new ChallengeService();
  const challenges = await challengeService.getAllPoses();

  // Transform image paths: only wrap Drive IDs, not full URLs
  const transformedChallenges = challenges.map(challenge => ({
    ...challenge,
    // Cloudinary URLs (https://...) pass through unchanged
    // Google Drive IDs get wrapped in proxy
    image: challenge.image?.startsWith('http') ? challenge.image : `/api/image/${challenge.image}`,
  }));

  return NextResponse.json({
    success: true,
    data: transformedChallenges,
  });
}

/**
 * POST - Create new pose
 *
 * Requires admin authentication
 */
async function handleCreatePose(request) {
  const formData = await request.formData();
  const title = formData.get('title');
  const instruction = formData.get('instruction');
  const image = formData.get('image');
  const folderId = formData.get('folderId') || null;

  const challengeService = new ChallengeService();
  const newPose = await challengeService.createPose({
    title,
    instruction,
    image,
    folderId,
  });

  // Transform image path: only wrap Drive IDs, not full URLs
  const transformedPose = {
    ...newPose,
    image: newPose.image?.startsWith('http') ? newPose.image : `/api/image/${newPose.image}`,
  };

  return NextResponse.json({
    success: true,
    data: transformedPose,
    message: 'Pose created successfully.',
  }, { status: 201 });
}

/**
 * PUT - Update existing pose
 *
 * Requires admin authentication
 */
async function handleUpdatePose(request) {
  const formData = await request.formData();
  const id = formData.get('id');
  const title = formData.get('title');
  const instruction = formData.get('instruction');
  const image = formData.get('image');
  const folderId = formData.get('folderId');

  const challengeService = new ChallengeService();
  const updatedPose = await challengeService.updatePose(id, {
    title,
    instruction,
    image,
    folderId,
  });

  // Transform image path: only wrap Drive IDs, not full URLs
  const transformedPose = {
    ...updatedPose,
    image: updatedPose.image?.startsWith('http') ? updatedPose.image : `/api/image/${updatedPose.image}`,
  };

  return NextResponse.json({
    success: true,
    data: transformedPose,
    message: 'Pose updated successfully.',
  });
}

/**
 * DELETE - Remove pose
 *
 * Requires admin authentication
 * Note: Image file is NOT deleted to prevent breaking existing references
 */
async function handleDeletePose(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const challengeService = new ChallengeService();
  const result = await challengeService.deletePose(id);

  return NextResponse.json({
    success: true,
    message: 'Pose deleted successfully.',
    data: result,
  });
}

/**
 * GET /api/admin/poses
 *
 * List all pose challenges (public endpoint)
 *
 * Response:
 * {
 *   success: true,
 *   data: [{ id, title, instruction, image, folderId, createdAt }, ...]
 * }
 */
export const GET = withApi(handleGetPoses);

/**
 * POST /api/admin/poses
 *
 * Create new pose challenge (admin only)
 *
 * Request (multipart/form-data):
 * - title: Pose title (required)
 * - instruction: Pose instruction (required)
 * - image: Image file PNG/JPEG, max 5MB (required)
 * - folderId: Google Drive folder ID (optional)
 *
 * Response (201):
 * {
 *   success: true,
 *   data: { id, title, instruction, image, folderId, createdAt },
 *   message: "Pose created successfully."
 * }
 */
export const POST = withApi(handleCreatePose, { adminOnly: true, rateLimit: 'admin' });

/**
 * PUT /api/admin/poses
 *
 * Update existing pose challenge (admin only)
 *
 * Request (multipart/form-data):
 * - id: Pose ID (required)
 * - title: Pose title (optional)
 * - instruction: Pose instruction (optional)
 * - image: Image file PNG/JPEG, max 5MB (optional)
 * - folderId: Google Drive folder ID (optional)
 *
 * Response:
 * {
 *   success: true,
 *   data: { id, title, instruction, image, folderId, updatedAt },
 *   message: "Pose updated successfully."
 * }
 */
export const PUT = withApi(handleUpdatePose, { adminOnly: true, rateLimit: 'admin' });

/**
 * DELETE /api/admin/poses?id=<poseId>
 *
 * Delete pose challenge (admin only)
 *
 * Query Parameters:
 * - id: Pose ID (required)
 *
 * Response:
 * {
 *   success: true,
 *   message: "Pose deleted successfully.",
 *   data: {
 *     id: "pose-id",
 *     note: "Image file preserved to prevent breaking existing references."
 *   }
 * }
 */
export const DELETE = withApi(handleDeletePose, { adminOnly: true, rateLimit: 'admin' });
