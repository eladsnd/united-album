"use client";
import { useEffect, useState } from 'react';
import { detectFacesMultiModel } from '../utils/clientFaceDetection';

/**
 * Background Face Processor
 *
 * Invisible component that processes photos needing face detection.
 * Runs in the background without blocking the UI.
 *
 * Features:
 * - Automatically checks for photos needing processing every 30 seconds
 * - Processes photos one at a time to avoid overwhelming the client
 * - Uses the same face detection logic as regular uploads
 * - Updates photo metadata via the /api/update-faces endpoint
 */
export default function BackgroundFaceProcessor() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

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

                    // Create image element
                    const img = new Image();
                    const imageUrl = URL.createObjectURL(blob);

                    await new Promise((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error('Failed to load image'));
                        img.src = imageUrl;
                    });

                    // Detect faces
                    const faceResults = await detectFacesMultiModel(img);

                    console.log(`[BgFaceProcessor] Detected ${faceResults?.length || 0} faces in photo ${photo.id}`);

                    // Extract face data
                    const faceIds = faceResults?.map(f => f.faceId) || [];
                    const faceBoxes = faceResults?.map(f => f.box) || [];
                    const mainFaceId = faceResults?.[0]?.faceId || 'unknown';

                    // Update photo metadata
                    const updateFormData = new FormData();
                    updateFormData.append('photoId', photo.id.toString());
                    updateFormData.append('faceIds', JSON.stringify(faceIds));
                    updateFormData.append('mainFaceId', mainFaceId);
                    updateFormData.append('faceBoxes', JSON.stringify(faceBoxes));

                    const updateRes = await fetch('/api/update-faces', {
                        method: 'POST',
                        body: updateFormData
                    });

                    if (updateRes.ok) {
                        console.log(`[BgFaceProcessor] ✓ Updated photo ${photo.id} with face data`);
                    } else {
                        console.error(`[BgFaceProcessor] ✗ Failed to update photo ${photo.id}`);
                    }

                    // Cleanup
                    URL.revokeObjectURL(imageUrl);

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

    // Check for pending photos periodically
    useEffect(() => {
        // Initial check after 5 seconds
        const initialTimer = setTimeout(processPendingPhotos, 5000);

        // Then check every 30 seconds
        const interval = setInterval(processPendingPhotos, 30000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, []);

    // This component renders nothing - it's purely background processing
    return null;
}
