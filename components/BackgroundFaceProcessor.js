"use client";
import { useEffect, useState } from 'react';
import { detectFaceInBrowser } from '../utils/clientFaceDetection';

/**
 * Background Face Processor
 *
 * Invisible component that processes photos needing face detection.
 * Runs in the background without blocking the UI.
 *
 * Features:
 * - Event-driven: Triggered immediately when bulk upload completes
 * - Fallback: Checks for pending photos every 2 minutes (catches edge cases)
 * - Processes photos one at a time to avoid overwhelming the client
 * - Uses the same face detection logic as regular uploads
 * - Updates photo metadata via the /api/update-faces endpoint
 *
 * Triggers:
 * - 'bulk-upload-complete' custom event → Immediate processing
 * - Initial check after 10 seconds
 * - Periodic check every 2 minutes (fallback)
 */
export default function BackgroundFaceProcessor() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Listen for custom events triggered by bulk upload
    useEffect(() => {
        const handleUploadComplete = () => {
            console.log('[BgFaceProcessor] Upload complete event received, starting face processing...');
            processPendingPhotos();
        };

        window.addEventListener('bulk-upload-complete', handleUploadComplete);

        return () => {
            window.removeEventListener('bulk-upload-complete', handleUploadComplete);
        };
    }, []);

    const processPendingPhotos = async () => {
        if (isProcessing) {
            console.log('[BgFaceProcessor] Already processing, skipping...');
            return;
        }

        try {
            setIsProcessing(true);

            // Check for photos needing processing
            const checkRes = await fetch('/api/process-faces');
            const checkData = await checkRes.json();

            setPendingCount(checkData.pendingCount || 0);

            if (checkData.pendingCount === 0) {
                console.log('[BgFaceProcessor] No photos need processing');
                return;
            }

            console.log(`[BgFaceProcessor] Found ${checkData.pendingCount} photos needing face detection`);

            // Get list of photos to process
            const processRes = await fetch('/api/process-faces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            const processData = await processRes.json();

            if (!processData.success || !processData.photosToProcess) {
                console.error('[BgFaceProcessor] Failed to get photos list');
                return;
            }

            // Process each photo (one at a time)
            for (const photo of processData.photosToProcess) {
                try {
                    console.log(`[BgFaceProcessor] Processing photo ${photo.id}...`);

                    // Download image for face detection
                    const imgRes = await fetch(photo.url);
                    const blob = await imgRes.blob();

                    // Convert blob to File object (required by detectFaceInBrowser)
                    const file = new File([blob], `photo_${photo.id}.jpg`, { type: blob.type });

                    // Detect faces using the same function as regular uploads
                    const faceResults = await detectFaceInBrowser(file);

                    console.log(`[BgFaceProcessor] Detected ${faceResults?.faceIds?.length || 0} faces in photo ${photo.id}`);

                    // Extract face data from results
                    const faceIds = faceResults?.faceIds || [];
                    const faceBoxes = faceResults?.boxes || [];
                    const mainFaceId = faceResults?.mainFaceId || 'unknown';
                    const faceThumbnails = faceResults?.faceThumbnails || [];

                    // Update photo metadata with face data and thumbnails
                    const updateFormData = new FormData();
                    updateFormData.append('photoId', photo.id.toString());
                    updateFormData.append('faceIds', JSON.stringify(faceIds));
                    updateFormData.append('mainFaceId', mainFaceId);
                    updateFormData.append('faceBoxes', JSON.stringify(faceBoxes));

                    // Attach face thumbnails if any were extracted
                    faceThumbnails.forEach((thumbnail, index) => {
                        if (thumbnail && thumbnail.blob) {
                            updateFormData.append(
                                `faceThumbnail_${thumbnail.faceId}`,
                                thumbnail.blob,
                                `face_${thumbnail.faceId}_thumb.jpg`
                            );
                        }
                    });

                    const updateRes = await fetch('/api/update-faces', {
                        method: 'POST',
                        body: updateFormData
                    });

                    if (updateRes.ok) {
                        console.log(`[BgFaceProcessor] ✓ Updated photo ${photo.id} with face data`);
                    } else {
                        console.error(`[BgFaceProcessor] ✗ Failed to update photo ${photo.id}`);
                    }

                    // Small delay between photos to avoid overwhelming the browser
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.error(`[BgFaceProcessor] Error processing photo ${photo.id}:`, error);
                }
            }

            console.log('[BgFaceProcessor] Batch complete');

        } catch (error) {
            console.error('[BgFaceProcessor] Error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    // Fallback: Check for pending photos periodically (less frequent now)
    // This catches any photos that might have been missed by the event system
    useEffect(() => {
        // Initial check after 10 seconds
        const initialTimer = setTimeout(processPendingPhotos, 10000);

        // Then check every 2 minutes (as a fallback only)
        const interval = setInterval(processPendingPhotos, 120000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, []);

    // This component renders nothing - it's purely background processing
    return null;
}
