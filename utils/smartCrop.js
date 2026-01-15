/**
 * Smart Cropping Utility
 *
 * Uses face detection to intelligently crop photos to show the full pose
 * with proper composition and centering around detected faces.
 */

/**
 * Calculate optimal crop area based on detected faces
 *
 * @param {Array} faceBoxes - Array of face bounding boxes from face detection
 *   Each box: { x, y, width, height }
 * @param {Object} imageDimensions - Original image dimensions
 *   { width, height }
 * @param {Object} options - Cropping options
 * @returns {Object} Crop area { x, y, width, height } or null for no crop
 */
export function calculateSmartCrop(faceBoxes, imageDimensions, options = {}) {
    const {
        targetAspectRatio = 4/3,    // Default 4:3 aspect ratio for poses
        paddingMultiplier = 2.5,    // How much space around faces (2.5x face height)
        minPaddingPx = 100,         // Minimum padding in pixels
        maxCropPercentage = 0.85,   // Maximum amount to crop (keep at least 85% of image)
    } = options;

    // If no faces detected, return null (no crop)
    if (!faceBoxes || faceBoxes.length === 0) {
        console.log('[Smart Crop] No faces detected, skipping crop');
        return null;
    }

    const { width: imgWidth, height: imgHeight } = imageDimensions;

    // Calculate bounding box that contains all faces
    const allFacesBounds = calculateBoundingBox(faceBoxes);

    // Calculate average face height for padding calculation
    const avgFaceHeight = faceBoxes.reduce((sum, box) => sum + box.height, 0) / faceBoxes.length;

    // Calculate padding (either based on face size or minimum)
    const padding = Math.max(
        avgFaceHeight * paddingMultiplier,
        minPaddingPx
    );

    // Expand bounds to include padding and full pose
    let cropX = Math.max(0, allFacesBounds.x - padding);
    let cropY = Math.max(0, allFacesBounds.y - (padding * 1.5)); // More padding above for full body
    let cropWidth = Math.min(
        imgWidth - cropX,
        allFacesBounds.width + (padding * 2)
    );
    let cropHeight = Math.min(
        imgHeight - cropY,
        allFacesBounds.height + (padding * 3) // Extra padding below for full body
    );

    // Adjust to target aspect ratio while keeping faces centered
    const currentRatio = cropWidth / cropHeight;

    if (currentRatio > targetAspectRatio) {
        // Too wide, reduce width or increase height
        const targetWidth = cropHeight * targetAspectRatio;
        const widthDiff = cropWidth - targetWidth;
        cropX += widthDiff / 2; // Center horizontally
        cropWidth = targetWidth;
    } else if (currentRatio < targetAspectRatio) {
        // Too tall, reduce height or increase width
        const targetHeight = cropWidth / targetAspectRatio;
        const heightDiff = cropHeight - targetHeight;
        cropY += heightDiff / 4; // Slightly offset from center (keep more below)
        cropHeight = targetHeight;
    }

    // Ensure crop area stays within image bounds
    if (cropX + cropWidth > imgWidth) {
        cropX = imgWidth - cropWidth;
    }
    if (cropY + cropHeight > imgHeight) {
        cropY = imgHeight - cropHeight;
    }
    if (cropX < 0) {
        cropWidth += cropX;
        cropX = 0;
    }
    if (cropY < 0) {
        cropHeight += cropY;
        cropY = 0;
    }

    // Check if crop is significant enough to apply
    const cropArea = cropWidth * cropHeight;
    const originalArea = imgWidth * imgHeight;
    const cropPercentage = cropArea / originalArea;

    if (cropPercentage > maxCropPercentage) {
        console.log('[Smart Crop] Crop would remove too little, skipping');
        return null;
    }

    const result = {
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
        metadata: {
            originalSize: `${imgWidth}x${imgHeight}`,
            cropSize: `${Math.round(cropWidth)}x${Math.round(cropHeight)}`,
            cropPercentage: (cropPercentage * 100).toFixed(1) + '%',
            facesIncluded: faceBoxes.length,
            aspectRatio: (cropWidth / cropHeight).toFixed(2),
        }
    };

    console.log('[Smart Crop] Calculated crop:', result.metadata);
    return result;
}

/**
 * Calculate bounding box that contains all face boxes
 *
 * @param {Array} faceBoxes - Array of face bounding boxes
 * @returns {Object} Combined bounding box { x, y, width, height }
 */
function calculateBoundingBox(faceBoxes) {
    if (faceBoxes.length === 1) {
        return faceBoxes[0];
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const box of faceBoxes) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * Apply smart crop to an image element using canvas
 *
 * @param {HTMLImageElement|File} image - Image element or file to crop
 * @param {Object} cropArea - Crop area from calculateSmartCrop()
 * @param {number} quality - JPEG quality (0-1), default 0.95
 * @returns {Promise<Blob>} Cropped image as blob
 */
export async function applyCrop(image, cropArea, quality = 0.95) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to crop dimensions
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;

        // Handle File input
        if (image instanceof File) {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    // Draw cropped portion
                    ctx.drawImage(
                        img,
                        cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                        0, 0, cropArea.width, cropArea.height
                    );

                    canvas.toBlob(
                        (blob) => resolve(blob),
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(image);
        }
        // Handle HTMLImageElement
        else {
            ctx.drawImage(
                image,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );

            canvas.toBlob(
                (blob) => resolve(blob),
                'image/jpeg',
                quality
            );
        }
    });
}

/**
 * Complete smart crop workflow:
 * 1. Detect faces
 * 2. Calculate optimal crop
 * 3. Apply crop if beneficial
 *
 * @param {File} imageFile - Image file to process
 * @param {Array} faceBoxes - Face detection results
 * @param {Object} options - Crop options
 * @returns {Promise<{croppedBlob: Blob|null, cropMetadata: Object}>}
 */
export async function smartCropImage(imageFile, faceBoxes, options = {}) {
    try {
        // Get image dimensions
        const dimensions = await getImageDimensions(imageFile);

        // Calculate optimal crop area
        const cropArea = calculateSmartCrop(faceBoxes, dimensions, options);

        // If no crop needed, return null
        if (!cropArea) {
            return { croppedBlob: null, cropMetadata: null };
        }

        // Apply crop
        const croppedBlob = await applyCrop(imageFile, cropArea);

        return {
            croppedBlob,
            cropMetadata: cropArea.metadata,
        };
    } catch (error) {
        console.error('[Smart Crop] Error:', error);
        return { croppedBlob: null, cropMetadata: null };
    }
}

/**
 * Get image dimensions from file
 *
 * @param {File} imageFile - Image file
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(imageFile) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
    });
}
