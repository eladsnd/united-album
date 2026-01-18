/**
 * Pose Management API
 *
 * Provides CRUD operations for pose challenges with admin authentication.
 * Handles pose metadata storage in data/challenges.json and image files
 * in public/challenges/.
 */

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '../../../../lib/adminAuth';
import prisma from '../../../../lib/prisma';
import fs from 'fs';
import path from 'path';

const CHALLENGES_IMAGE_DIR = path.join(process.cwd(), 'public', 'challenges');

// Allowed image types
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Generate a URL-safe slug from a title
 * Supports Unicode characters (Hebrew, Arabic, Chinese, etc.)
 *
 * @param {string} title - Title to slugify
 * @returns {string} - URL-safe slug (guaranteed non-empty)
 */
function slugify(title) {
  // Normalize unicode and remove diacritics
  const normalized = title
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks

  // Keep Unicode letters, numbers, spaces, and hyphens
  // \p{L} = any letter in any language
  // \p{N} = any numeric character
  const slug = normalized
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Unicode-aware: keep letters/numbers
    .replace(/[\s_-]+/g, '-') // Replace whitespace with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Fallback: if slug is empty (e.g., all special characters), use timestamp
  if (!slug || slug.length === 0) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    console.warn(`[Pose API] Title "${title}" produced empty slug, using fallback: pose-${timestamp}-${random}`);
    return `pose-${timestamp}-${random}`;
  }

  return slug;
}

/**
 * Get all challenges from database
 *
 * @returns {Promise<Array>} - Array of pose challenges
 */
async function getChallenges() {
  try {
    const challenges = await prisma.challenge.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return challenges;
  } catch (error) {
    console.error('Error reading challenges:', error);
    throw new Error('Failed to read challenges data');
  }
}

/**
 * Save uploaded image file
 *
 * @param {File} file - Image file from FormData
 * @param {string} poseId - Pose ID for filename
 * @returns {string} - Public URL path to saved image
 */
async function saveImageFile(file, poseId) {
  try {
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Only PNG and JPEG images are allowed.');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 5MB limit.');
    }

    // Ensure challenges directory exists
    if (!fs.existsSync(CHALLENGES_IMAGE_DIR)) {
      fs.mkdirSync(CHALLENGES_IMAGE_DIR, { recursive: true });
    }

    // Determine file extension
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${poseId}.${ext}`;
    const filepath = path.join(CHALLENGES_IMAGE_DIR, filename);

    // Security: Validate that resolved path stays within challenges directory
    // Prevents path traversal attacks (e.g., poseId = "../../../etc/passwd")
    const resolvedPath = path.resolve(filepath);
    const basePath = path.resolve(CHALLENGES_IMAGE_DIR);

    if (!resolvedPath.startsWith(basePath + path.sep) && resolvedPath !== basePath) {
        throw new Error(
            `Security: Path traversal detected. Pose ID "${poseId}" attempted to write outside challenges directory.`
        );
    }

    // Convert file to buffer and save
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Return public URL path
    return `/challenges/${filename}`;
  } catch (error) {
    console.error('Error saving image file:', error);
    throw error;
  }
}

/**
 * GET - List all poses
 *
 * No authentication required (public data)
 */
export async function GET(request) {
  try {
    const challenges = await getChallenges();
    return NextResponse.json({
      success: true,
      data: challenges,
    });
  } catch (error) {
    console.error('GET /api/admin/poses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch poses' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new pose
 *
 * Requires admin authentication
 * Accepts FormData: title, instruction, image (file), folderId (optional)
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const title = formData.get('title');
    const instruction = formData.get('instruction');
    const image = formData.get('image');
    const folderId = formData.get('folderId') || null;

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      return NextResponse.json(
        { error: 'Instruction is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (!image || !(image instanceof File)) {
      return NextResponse.json(
        { error: 'Image file is required.' },
        { status: 400 }
      );
    }

    // Generate unique ID from title
    const id = slugify(title);

    // Check if ID already exists in database
    const existingChallenge = await prisma.challenge.findUnique({
      where: { id },
    });

    if (existingChallenge) {
      return NextResponse.json(
        { error: `Pose with ID "${id}" already exists. Please use a different title.` },
        { status: 409 }
      );
    }

    // Save image file
    let imagePath;
    try {
      imagePath = await saveImageFile(image, id);
    } catch (imageError) {
      return NextResponse.json(
        { error: imageError.message },
        { status: 400 }
      );
    }

    // Create new pose in database
    const newPose = await prisma.challenge.create({
      data: {
        id,
        title: title.trim(),
        instruction: instruction.trim(),
        image: imagePath,
        folderId: folderId || null,
      },
    });

    console.log(`[Pose API] Created new pose: ${id}`);

    return NextResponse.json({
      success: true,
      data: newPose,
      message: 'Pose created successfully.',
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/admin/poses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create pose' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update existing pose
 *
 * Requires admin authentication
 * Accepts FormData: id, title (optional), instruction (optional),
 *                   image (optional), folderId (optional)
 */
export async function PUT(request) {
  try {
    // Verify admin authentication
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const id = formData.get('id');
    const title = formData.get('title');
    const instruction = formData.get('instruction');
    const image = formData.get('image');
    const folderId = formData.get('folderId');

    // Validate required ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Pose ID is required.' },
        { status: 400 }
      );
    }

    // Find existing pose in database
    const existingPose = await prisma.challenge.findUnique({
      where: { id },
    });

    if (!existingPose) {
      return NextResponse.json(
        { error: `Pose with ID "${id}" not found.` },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData = {};

    if (title && typeof title === 'string' && title.trim().length > 0) {
      updateData.title = title.trim();
    }

    if (instruction && typeof instruction === 'string' && instruction.trim().length > 0) {
      updateData.instruction = instruction.trim();
    }

    if (folderId !== null && folderId !== undefined) {
      updateData.folderId = folderId || null;
    }

    // Handle image update if provided
    if (image && image instanceof File) {
      try {
        const newImagePath = await saveImageFile(image, id);
        updateData.image = newImagePath;
      } catch (imageError) {
        return NextResponse.json(
          { error: imageError.message },
          { status: 400 }
        );
      }
    }

    // Update in database
    const updatedPose = await prisma.challenge.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Pose API] Updated pose: ${id}`);

    return NextResponse.json({
      success: true,
      data: updatedPose,
      message: 'Pose updated successfully.',
    });

  } catch (error) {
    console.error('PUT /api/admin/poses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update pose' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove pose
 *
 * Requires admin authentication
 * Accepts query param: id
 * Note: Image file is NOT deleted to prevent breaking existing references
 */
export async function DELETE(request) {
  try {
    // Verify admin authentication
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    // Get ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Validate ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Pose ID is required as a query parameter.' },
        { status: 400 }
      );
    }

    // Delete from database
    try {
      const deletedPose = await prisma.challenge.delete({
        where: { id },
      });

      console.log(`[Pose API] Deleted pose: ${id}`);
      console.log(`[Pose API] Image file preserved at: ${deletedPose.image}`);

      return NextResponse.json({
        success: true,
        message: 'Pose deleted successfully.',
        data: {
          id: deletedPose.id,
          note: 'Image file preserved to prevent breaking existing references.',
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma error: Record not found
        return NextResponse.json(
          { error: `Pose with ID "${id}" not found.` },
          { status: 404 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('DELETE /api/admin/poses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete pose' },
      { status: 500 }
    );
  }
}
