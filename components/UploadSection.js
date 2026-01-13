"use strict";
import { useState } from 'react';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';

export default function UploadSection() {
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus('uploading');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                setStatus('success');
                // Trigger gallery refresh
                window.dispatchEvent(new Event('photoUploaded'));
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Upload failed:', error);
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
                    <span>Oops! Upload failed. Please try again.</span>
                    <button className="btn" onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>
                        Try Again
                    </button>
                </div>
            )}

            <style jsx>{`
        .upload-section {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .upload-label {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          background: #d4af37;
          color: white;
          padding: 1rem 2rem;
          border-radius: 50px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        .upload-label:hover {
          background: #b8962d;
          transform: scale(1.05);
        }
        .status-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          text-align: center;
        }
        .status-box.success {
          color: #2e7d32;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
