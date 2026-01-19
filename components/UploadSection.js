"use strict";
import { useState, useEffect } from 'react';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import { detectFaceInBrowser, loadFaceModels } from '../utils/clientFaceDetection';
import { smartCropImage } from '../utils/smartCrop';
import { useToast } from './ToastContainer';

export default function UploadSection({ folderId, poseTitle }) {
    const [status, setStatus] = useState('idle'); // idle, analyzing, uploading, success, error
    const [uploadedUrl, setUploadedUrl] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [modelsReady, setModelsReady] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false); // Prevent duplicate uploads
    const toast = useToast();

    // Get or create uploader session ID
    const getUploaderId = () => {
        if (typeof window === 'undefined') return null;

        let uploaderId = localStorage.getItem('uploaderId');
        if (!uploaderId) {
            uploaderId = `uploader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('uploaderId', uploaderId);
        }
        return uploaderId;
    };

    // Load face detection models on component mount
    useEffect(() => {
        loadFaceModels()
            .then(loaded => {
                setModelsReady(loaded);
                if (loaded) {
                    console.log('[Upload] Face detection models ready');
                } else {
                    console.warn('[Upload] Face detection models failed to load - uploads will work without face detection');
                }
            })
            .catch(error => {
                console.error('[Upload] Error loading face models:', error);
                setModelsReady(false); // Ensure we continue without face detection
            });
    }, []);

    const compressImage = (file) => {
        // Skip client-side compression - let the server handle it
        // Server has ImageCompressionService that intelligently compresses to meet 5MB limit
        // This avoids double-compression and ensures consistent quality
        return Promise.resolve(file);
    };

    // Upload with exponential backoff retry
    const uploadWithRetry = async (formData, attempt = 0) => {
        const MAX_RETRIES = 3;
        const BACKOFF_MS = 1000; // 1 second base
        const UPLOAD_TIMEOUT_MS = 60000; // 60 second timeout for large files

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.error('Non-JSON response received:', text);
                throw new Error('Server returned an unexpected response format.');
            }

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Upload failed');
            }

            return data;
        } catch (error) {
            // Better error messages for common issues
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'Upload timed out. Please check your connection and try again.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your connection.';
            }

            if (attempt < MAX_RETRIES) {
                const delay = BACKOFF_MS * Math.pow(2, attempt); // Exponential backoff
                toast.showWarning(`${errorMessage} Retrying in ${delay/1000}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
                setRetryCount(attempt + 1);

                await new Promise(resolve => setTimeout(resolve, delay));
                return uploadWithRetry(formData, attempt + 1);
            }

            // Enhance error message for final failure
            error.message = errorMessage;
            throw error;
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || isUploading) {
            if (isUploading) {
                console.log('[Upload] Upload already in progress, ignoring duplicate request');
            }
            return;
        }

        setIsUploading(true);
        setStatus('analyzing');
        setUploadedUrl(null);
        setErrorMessage('');
        setUploadProgress(0);
        setRetryCount(0);

        try {
            // Upload original uncropped image
            // Face detection will run on the uploaded version to get accurate coordinates
            let fileToUpload = file;

            setUploadProgress(20);

            // Step 2: Compress and upload image (40% progress)
            setStatus('uploading');
            const compressedFile = await compressImage(fileToUpload);
            setUploadProgress(30);

            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('detectFaces', modelsReady ? 'true' : 'false'); // Tell server whether to expect face detection
            formData.append('uploaderId', getUploaderId()); // Add uploader ID
            if (folderId) formData.append('folderId', folderId);
            if (poseTitle) formData.append('poseId', poseTitle);

            setUploadProgress(40);
            const uploadData = await uploadWithRetry(formData);
            const photoId = uploadData.photo.driveId;

            setUploadProgress(50);

            // Step 2: If face detection is enabled, detect faces from the uploaded image
            if (modelsReady && photoId) {
                try {
                    setStatus('analyzing');

                    // Download the image from Drive to detect faces
                    const imageUrl = `/api/image/${photoId}`;
                    const imageResponse = await fetch(imageUrl);

                    if (!imageResponse.ok) {
                        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                    }

                    const imageBlob = await imageResponse.blob();
                    const imageFile = new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' });

                    setUploadProgress(60);

                    // Run face detection on the Drive version
                    const result = await detectFaceInBrowser(imageFile);

                    setUploadProgress(90);

                if (result.faceIds && result.faceIds[0] !== 'unknown') {
                    // Fetch existing faces to check which ones already have thumbnails
                    const facesResponse = await fetch('/api/faces');
                    const existingFaces = await facesResponse.json();
                    const facesWithThumbnails = new Set(
                        existingFaces
                            .filter(f => f.thumbnailDriveId)
                            .map(f => f.faceId)
                    );

                    // Only upload thumbnails for NEW faces (no existing thumbnail)
                    const newFaceThumbnails = result.faceThumbnails.filter(
                        thumb => !facesWithThumbnails.has(thumb.faceId)
                    );

                    console.log(`[Upload] ${result.faceIds.length} faces detected, ${newFaceThumbnails.length} new thumbnails to upload`);

                    const thumbFormData = new FormData();
                    thumbFormData.append('photoId', uploadData.photo.id);
                    thumbFormData.append('driveId', photoId);
                    thumbFormData.append('faceIds', result.faceIds.join(','));
                    thumbFormData.append('mainFaceId', result.mainFaceId);
                    thumbFormData.append('faceBoxes', JSON.stringify(result.boxes));

                    // Only append thumbnails for new faces
                    newFaceThumbnails.forEach((thumbnail) => {
                        thumbFormData.append(`faceThumbnail_${thumbnail.faceId}`, thumbnail.blob, `face_${thumbnail.faceId}.jpg`);
                    });

                    await fetch('/api/update-faces', {
                        method: 'POST',
                        body: thumbFormData
                    });

                    // Show final success with face info
                    const newFacesCount = newFaceThumbnails.length;
                    if (newFacesCount > 0) {
                        toast.showSuccess(`Photo uploaded! ${result.faceIds.length} face(s), ${newFacesCount} new 🎉`);
                    } else {
                        toast.showSuccess(`Photo uploaded! ${result.faceIds.length} face(s) - all recognized 🎉`);
                    }
                } else {
                    toast.showSuccess('Photo uploaded! No faces detected 🎉');
                }
                } catch (faceError) {
                    // Face detection failed, but photo was uploaded successfully
                    console.warn('[Upload] Face detection failed:', faceError);
                    toast.showWarning('Photo uploaded! Face detection unavailable - photo saved without face tagging.');
                }
            } else {
                // No face detection - just show success
                toast.showSuccess('Photo uploaded successfully! 🎉');
            }

            setUploadProgress(100);

            setStatus('success');
            setUploadedUrl(uploadData.photo?.url || uploadData.driveLink);

            // Trigger gallery refresh
            window.dispatchEvent(new Event('photoUploaded'));

        } catch (error) {
            console.error('Upload failed:', error);
            const errorMsg = error.message || 'Network error. Please check your connection.';
            setErrorMessage(errorMsg);
            setStatus('error');
            toast.showError(`Upload failed: ${errorMsg}`);
        } finally {
            setIsUploading(false);
        }
    };

    const reset = () => {
        setStatus('idle');
        setUploadedUrl(null);
        setErrorMessage('');
    };

    return (
        <div className="upload-section">
            {status === 'idle' && (
                <label className="upload-label glass-effect">
                    <Upload size={32} />
                    <span className="upload-text">Upload your {poseTitle || 'Challenge'} Photo</span>
                    <span className="upload-subtext">Click to browse or take a photo</span>
                    <input
                        type="file"
                        onChange={handleUpload}
                        disabled={isUploading}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </label>
            )}

            {status === 'analyzing' && (
                <div className="status-box glass-effect">
                    <Loader2 className="animate-spin" size={32} />
                    <span className="status-title">Analyzing Face...</span>
                    <span className="status-desc">Detecting and matching faces</span>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <span className="progress-text">{uploadProgress}%</span>
                </div>
            )}

            {status === 'uploading' && (
                <div className="status-box glass-effect">
                    <Loader2 className="animate-spin" size={32} />
                    <span className="status-title">Processing & Uploading...</span>
                    <span className="status-desc">
                        {retryCount > 0 ? `Retry attempt ${retryCount}/3` : 'Optimizing image for the album'}
                    </span>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <span className="progress-text">{uploadProgress}%</span>
                </div>
            )}

            {status === 'success' && (
                <div className="status-box success glass-effect">
                    <div className="success-icon-wrapper">
                        <CheckCircle size={32} />
                    </div>
                    <span className="status-title">Photo Uploaded!</span>
                    <p className="status-desc">Beautiful! Your photo is now in the album.</p>

                    {uploadedUrl && (
                        <div className="uploaded-preview">
                            <img src={uploadedUrl} alt="Uploaded" className="preview-img" referrerPolicy="no-referrer" />
                        </div>
                    )}

                    <button className="btn primary-btn" onClick={reset}>
                        Take Another Photo
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div className="status-box error glass-effect">
                    <span className="status-title">Upload Failed</span>
                    <p className="status-desc">{errorMessage}</p>
                    <button className="btn" onClick={reset}>
                        Try Again
                    </button>
                </div>
            )}

            <style jsx>{`
                .upload-section {
                    width: 100%;
                    max-width: 400px;
                    margin: 2rem auto;
                }
                .glass-effect {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    border-radius: 20px;
                    padding: 2.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                .upload-label {
                    cursor: pointer;
                    transition: all 0.3s ease;
                    color: var(--primary);
                    border: 2px dashed rgba(var(--primary-rgb), 0.3);
                }
                .upload-label:hover {
                    transform: translateY(-5px);
                    background: var(--cream);
                    border-color: var(--primary);
                }
                .upload-text {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.25rem;
                    margin: 1rem 0 0.5rem;
                    font-weight: 600;
                }
                .upload-subtext {
                    font-size: 0.9rem;
                    opacity: 0.7;
                }
                .status-box {
                    width: 100%;
                }
                .status-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.5rem;
                    margin: 1rem 0;
                    color: var(--text-dark);
                }
                .status-desc {
                    margin-bottom: 1.5rem;
                    color: var(--text-dark);
                    opacity: 0.8;
                }
                .success-icon-wrapper {
                    color: #4caf50;
                    margin-bottom: 0.5rem;
                }
                .uploaded-preview {
                    width: 100%;
                    margin-bottom: 1.5rem;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .preview-img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                }
                .btn {
                    padding: 0.8rem 1.5rem;
                    border-radius: 50px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .primary-btn {
                    background: var(--primary);
                    color: white;
                }
                .primary-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3);
                }
            `}</style>
        </div>
    );
}
