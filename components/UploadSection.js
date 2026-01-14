"use strict";
import { useState, useEffect } from 'react';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import { detectFaceInBrowser, loadFaceModels } from '../utils/clientFaceDetection';

export default function UploadSection({ folderId, poseTitle }) {
    const [status, setStatus] = useState('idle'); // idle, analyzing, uploading, success, error
    const [uploadedUrl, setUploadedUrl] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [modelsReady, setModelsReady] = useState(false);

    // Load face detection models on component mount
    useEffect(() => {
        loadFaceModels().then(loaded => {
            setModelsReady(loaded);
            if (loaded) {
                console.log('[Upload] Face detection models ready');
            }
        });
    }, []);

    const compressImage = (file) => {
        // ... (keep compressImage as is)
        if (typeof window === 'undefined' || !window.HTMLCanvasElement || process.env.NODE_ENV === 'test') {
            return Promise.resolve(file);
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new window.Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const scaleSize = MAX_WIDTH / img.width;

                    if (img.width > MAX_WIDTH) {
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;
                    } else {
                        canvas.width = img.width;
                        canvas.height = img.height;
                    }

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        }));
                    }, 'image/jpeg', 0.8); // 80% quality
                };
            };
        });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus('analyzing');
        setUploadedUrl(null);
        setErrorMessage('');

        try {
            // Step 1: Detect face in browser
            let faceIds = ['unknown'];
            let mainFaceId = 'unknown';
            let faceDescriptors = [];
            let faceBoxes = [];

            if (modelsReady) {
                const result = await detectFaceInBrowser(file);
                faceIds = result.faceIds;
                mainFaceId = result.mainFaceId;
                faceDescriptors = result.descriptors;
                faceBoxes = result.boxes || [];

                // Save face descriptors ONLY if faces were actually detected
                if (result.descriptors && result.descriptors.length > 0 && result.faceIds[0] !== 'unknown') {
                    await Promise.all(
                        result.faceIds.map((faceId, index) =>
                            fetch('/api/faces', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    faceId,
                                    descriptor: result.descriptors[index],
                                    box: result.boxes[index] // Save bounding box
                                })
                            })
                        )
                    );
                }
            }

            // Step 2: Compress image
            setStatus('uploading');
            const compressedFile = await compressImage(file);

            // Step 3: Upload to server
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('mainFaceId', mainFaceId); // Primary face for grouping
            formData.append('faceIds', faceIds.join(',')); // All detected faces
            formData.append('faceBoxes', JSON.stringify(faceBoxes)); // Face bounding boxes
            if (folderId) formData.append('folderId', folderId);
            if (poseTitle) formData.append('poseId', poseTitle);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            // Handle potential non-JSON responses (like 500 HTML errors)
            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.error('Non-JSON response received:', text);
                throw new Error('Server returned an unexpected response format.');
            }

            if (response.ok) {
                setStatus('success');
                setUploadedUrl(data.driveLink);
                // Trigger gallery refresh
                window.dispatchEvent(new Event('photoUploaded'));
            } else {
                setErrorMessage(data.error || 'Upload failed. Please try again.');
                setStatus('error');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            setErrorMessage(error.message || 'Network error. Please check your connection.');
            setStatus('error');
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
                    <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept="image/*" />
                </label>
            )}

            {status === 'analyzing' && (
                <div className="status-box glass-effect">
                    <Loader2 className="animate-spin" size={32} />
                    <span className="status-title">Analyzing Face...</span>
                    <span className="status-desc">Detecting and matching face</span>
                </div>
            )}

            {status === 'uploading' && (
                <div className="status-box glass-effect">
                    <Loader2 className="animate-spin" size={32} />
                    <span className="status-title">Processing & Uploading...</span>
                    <span className="status-desc">Optimizing image for the album</span>
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
