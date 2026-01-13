"use strict";
import { useState } from 'react';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';

export default function UploadSection({ folderId, poseTitle }) {
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const compressImage = (file) => {
        // Bypass compression in test environments where canvas/blob might not be fully supported
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

        setStatus('uploading');

        try {
            // Compress image before upload
            const compressedFile = await compressImage(file);

            const formData = new FormData();
            formData.append('file', compressedFile);
            if (folderId) formData.append('folderId', folderId);
            if (poseTitle) formData.append('poseId', poseTitle);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                setStatus('success');
                // Trigger gallery refresh
                window.dispatchEvent(new Event('photoUploaded'));
            } else {
                const errorData = await response.json();
                setErrorMessage(errorData.error || 'Upload failed. Please try again.');
                setStatus('error');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            setErrorMessage('Network error. Please check your connection.');
            setStatus('error');
        }
    };

    return (
        <div className="upload-section">
            {status === 'idle' && (
                <label className="upload-label">
                    <Upload size={24} />
                    <span>Upload your Challenge Photo</span>
                    <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept="image/*" />
                </label>
            )}

            {status === 'uploading' && (
                <div className="status-box">
                    <Loader2 className="animate-spin" size={24} />
                    <span>Analyzing faces & uploading to Drive...</span>
                </div>
            )}

            {status === 'success' && (
                <div className="status-box success">
                    <CheckCircle size={24} />
                    <span>Beautiful! Your photo is now in the album.</span>
                    <button className="btn" onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>
                        Take Another Challenge
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div className="status-box" style={{ color: '#d32f2f' }}>
                    <span style={{ fontWeight: '600' }}>Oops! something went wrong.</span>
                    <span style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>{errorMessage}</span>
                    <button className="btn" onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>
                        Try Again
                    </button>
                </div>
            )}

        </div>
    );
}
