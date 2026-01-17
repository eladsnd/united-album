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

    console.log('[Smart Crop] Starting calculation with', faceBoxes?.length, 'faces, image:', imageDimensions);

    // Validate image dimensions
    if (!imageDimensions ||
        typeof imageDimensions.width !== 'number' ||
        typeof imageDimensions.height !== 'number' ||
        imageDimensions.width <= 0 ||
        imageDimensions.height <= 0 ||
        !isFinite(imageDimensions.width) ||
        !isFinite(imageDimensions.height)) {
        console.warn('[Smart Crop] Invalid image dimensions:', imageDimensions);
        return null;
    }

    // Validate face boxes array
    if (!Array.isArray(faceBoxes) || faceBoxes.length === 0) {
        console.log('[Smart Crop] No valid face boxes array');
        return null;
    }

    // Validate and filter each face box
    const validBoxes = faceBoxes.filter(box => {
        if (!box || typeof box !== 'object') {
            console.warn('[Smart Crop] Invalid box object:', box);
            return false;
        }

        const { x, y, width, height } = box;

        // Check all required properties exist and are valid numbers
        if (typeof x !== 'number' || !isFinite(x) ||
            typeof y !== 'number' || !isFinite(y) ||
            typeof width !== 'number' || !isFinite(width) || width <= 0 ||
            typeof height !== 'number' || !isFinite(height) || height <= 0) {
            console.warn('[Smart Crop] Invalid box coordinates:', box);
            return false;
        }

        return true;
    });

    if (validBoxes.length === 0) {
        console.warn('[Smart Crop] No valid face boxes after filtering');
        return null;
    }

    console.log(`[Smart Crop] Validated ${validBoxes.length}/${faceBoxes.length} face boxes`);

    const { width: imgWidth, height: imgHeight } = imageDimensions;

    // Calculate bounding box that contains all faces
    const allFacesBounds = calculateBoundingBox(validBoxes);

    // Calculate average face height for padding calculation
    const avgFaceHeight = validBoxes.reduce((sum, box) => sum + box.height, 0) / validBoxes.length;

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
            facesIncluded: validBoxes.length,
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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    try {
        // Set canvas size to crop dimensions
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;

        // Handle File input
        if (image instanceof File) {
            const blob = await new Promise((resolve, reject) => {
                const img = new Image();
                const reader = new FileReader();

                reader.onload = (e) => {
                    img.onload = () => {
                        try {
                            // Draw cropped portion
                            ctx.drawImage(
                                img,
                                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                                0, 0, cropArea.width, cropArea.height
                            );

                            canvas.toBlob(
                                (blob) => {
                                    if (blob) {
                                        resolve(blob);
                                    } else {
                                        reject(new Error('Failed to create blob from canvas'));
                                    }
                                },
                                'image/jpeg',
                                quality
                            );
                        } catch (drawError) {
                            reject(drawError);
                        }
                    };
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(image);
            });

            return blob;
        }
        // Handle HTMLImageElement
        else {
            ctx.drawImage(
                image,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob from canvas'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            });

            return blob;
        }
    } finally {
        // Explicitly clean up canvas to prevent memory leaks
        canvas.width = 0;
        canvas.height = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
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
