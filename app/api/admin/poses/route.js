/**
 * Pose Management API
 *
 * Provides CRUD operations for pose challenges with admin authentication.
 * Handles pose metadata storage in data/challenges.json and image files
 * in public/challenges/.
 */

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '../../../../lib/adminAuth';
import fs from 'fs';
import path from 'path';

const CHALLENGES_FILE_PATH = path.join(process.cwd(), 'data', 'challenges.json');
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
 * Read challenges from JSON file
 *
 * @returns {Array} - Array of pose challenges
 */
function readChallenges() {
  try {
    if (!fs.existsSync(CHALLENGES_FILE_PATH)) {
      // Initialize with empty array if file doesn't exist
      fs.writeFileSync(CHALLENGES_FILE_PATH, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(CHALLENGES_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading challenges:', error);
    throw new Error('Failed to read challenges data');
  }
}

/**
 * Write challenges to JSON file (atomic operation)
 *
 * @param {Array} challenges - Array of pose challenges
 */
function writeChallenges(challenges) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CHALLENGES_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to temporary file first (atomic write)
    const tempPath = `${CHALLENGES_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(challenges, null, 2));

    // Rename to actual file (atomic on most systems)
    fs.renameSync(tempPath, CHALLENGES_FILE_PATH);
  } catch (error) {
    console.error('Error writing challenges:', error);
    throw new Error('Failed to save challenges data');
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
    const challenges = readChallenges();
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

    // Check if ID already exists
    const challenges = readChallenges();
    if (challenges.some(challenge => challenge.id === id)) {
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

    // Create new pose object
    const newPose = {
      id,
      title: title.trim(),
      instruction: instruction.trim(),
      image: imagePath,
      folderId: folderId || null,
    };

    // Add to challenges array
    challenges.push(newPose);

    // Save to file
    try {
      writeChallenges(challenges);
    } catch (writeError) {
      // Attempt to cleanup saved image on failure
      try {
        const imageFsPath = path.join(process.cwd(), 'public', imagePath);
        if (fs.existsSync(imageFsPath)) {
          fs.unlinkSync(imageFsPath);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup image after write failure:', cleanupError);
      }
      throw writeError;
    }

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

    // Read challenges
    const challenges = readChallenges();
    const poseIndex = challenges.findIndex(challenge => challenge.id === id);

    if (poseIndex === -1) {
      return NextResponse.json(
        { error: `Pose with ID "${id}" not found.` },
        { status: 404 }
      );
    }

    // Get existing pose
    const existingPose = challenges[poseIndex];
    const updatedPose = { ...existingPose };

    // Update fields if provided
    if (title && typeof title === 'string' && title.trim().length > 0) {
      updatedPose.title = title.trim();
    }

    if (instruction && typeof instruction === 'string' && instruction.trim().length > 0) {
      updatedPose.instruction = instruction.trim();
    }

    if (folderId !== null && folderId !== undefined) {
      updatedPose.folderId = folderId || null;
    }

    // Handle image update if provided
    if (image && image instanceof File) {
      try {
        const newImagePath = await saveImageFile(image, id);
        updatedPose.image = newImagePath;
      } catch (imageError) {
        return NextResponse.json(
          { error: imageError.message },
          { status: 400 }
        );
      }
    }

    // Update in array
    challenges[poseIndex] = updatedPose;

    // Save to file
    writeChallenges(challenges);

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

    // Read challenges
    const challenges = readChallenges();
    const poseIndex = challenges.findIndex(challenge => challenge.id === id);

    if (poseIndex === -1) {
      return NextResponse.json(
        { error: `Pose with ID "${id}" not found.` },
        { status: 404 }
      );
    }

    // Remove from array
    const deletedPose = challenges.splice(poseIndex, 1)[0];

    // Save to file
    writeChallenges(challenges);

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
    console.error('DELETE /api/admin/poses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete pose' },
      { status: 500 }
    );
  }
}
