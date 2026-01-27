"use client";
import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Video } from 'lucide-react';
import { useFeatureFlag } from '../lib/hooks/useFeatureFlag';

const CHUNK_SIZE = 5; // Upload 5 files at a time
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per file

export default function BulkUpload() {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploadResults, setUploadResults] = useState([]);
    const fileInputRef = useRef(null);

    // Check if bulk upload feature is enabled
    const { enabled: bulkUploadEnabled, loading } = useFeatureFlag('bulkUpload');

    // Show loading state while checking feature flag
    if (loading) {
        return (
            <div className="text-center py-8 text-gray-500">
                Loading...
            </div>
        );
    }

    // Show disabled message if feature is off
    if (!bulkUploadEnabled) {
        return (
            <div className="text-center py-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                    <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Bulk Upload Disabled
                    </h3>
                    <p className="text-gray-600">
                        The bulk upload feature is currently disabled. Please contact an administrator to enable it.
                    </p>
                </div>
            </div>
        );
    }

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);

        // Filter valid files (images and videos)
        const validFiles = files.filter(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isSizeValid = file.size <= MAX_FILE_SIZE;

            if (!isSizeValid) {
                console.warn(`File ${file.name} exceeds 50MB limit`);
                return false;
            }

            return isImage || isVideo;
        });

        setSelectedFiles(prev => [...prev, ...validFiles]);

        // Reset input to allow re-selecting same files
        e.target.value = '';
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const clearAll = () => {
        setSelectedFiles([]);
        setUploadProgress({});
        setUploadResults([]);
    };

    const uploadChunk = async (files) => {
        const results = [];

        for (const file of files) {
            try {
                // Update progress
                setUploadProgress(prev => ({
                    ...prev,
                    [file.name]: 'uploading'
                }));

                const formData = new FormData();
                formData.append('file', file);
                formData.append('bulkUpload', 'true'); // Flag to skip face detection

                // Get or create uploaderId for delete permissions
                const uploaderId = localStorage.getItem('uploaderId') ||
                    `uploader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                if (!localStorage.getItem('uploaderId')) {
                    localStorage.setItem('uploaderId', uploaderId);
                }
                formData.append('uploaderId', uploaderId);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    setUploadProgress(prev => ({
                        ...prev,
                        [file.name]: 'success'
                    }));
                    results.push({ file: file.name, success: true });
                } else {
                    throw new Error(data.error || 'Upload failed');
                }
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
                setUploadProgress(prev => ({
                    ...prev,
                    [file.name]: 'error'
                }));
                results.push({ file: file.name, success: false, error: error.message });
            }
        }

        return results;
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        setUploading(true);
        setUploadResults([]);
        setUploadProgress({});

        try {
            // Split files into chunks
            const chunks = [];
            for (let i = 0; i < selectedFiles.length; i += CHUNK_SIZE) {
                chunks.push(selectedFiles.slice(i, i + CHUNK_SIZE));
            }

            console.log(`[Bulk Upload] Uploading ${selectedFiles.length} files in ${chunks.length} chunks`);

            // Upload chunks sequentially
            const allResults = [];
            for (let i = 0; i < chunks.length; i++) {
                console.log(`[Bulk Upload] Processing chunk ${i + 1}/${chunks.length}`);
                const chunkResults = await uploadChunk(chunks[i]);
                allResults.push(...chunkResults);
            }

            setUploadResults(allResults);

            // Calculate success/failure counts
            const successCount = allResults.filter(r => r.success).length;
            const failureCount = allResults.filter(r => !r.success).length;

            console.log(`[Bulk Upload] Complete: ${successCount} succeeded, ${failureCount} failed`);

            // Trigger background face processing immediately via custom event
            if (successCount > 0) {
                console.log('[Bulk Upload] Dispatching upload complete event...');
                window.dispatchEvent(new CustomEvent('bulk-upload-complete', {
                    detail: { uploadedCount: successCount }
                }));
            }
        } catch (error) {
            console.error('[Bulk Upload] Error:', error);
        } finally {
            setUploading(false);
        }
    };

    const getFileIcon = (file) => {
        if (file.type.startsWith('video/')) {
            return <Video size={24} className="text-blue-600" />;
        }
        return <ImageIcon size={24} className="text-green-600" />;
    };

    const getStatusIcon = (fileName) => {
        const status = uploadProgress[fileName];
        if (status === 'success') {
            return <CheckCircle size={20} style={{ color: '#10b981' }} />;
        }
        if (status === 'error') {
            return <AlertCircle size={20} style={{ color: '#ef4444' }} />;
        }
        if (status === 'uploading') {
            return <span className="animate-spin" style={{ fontSize: '1.2rem' }}>⟳</span>;
        }
        return null;
    };

    const successCount = Object.values(uploadProgress).filter(s => s === 'success').length;
    const totalFiles = selectedFiles.length;

    return (
        <div className="bulk-upload-container">
            <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h1 style={{ fontWeight: '400', marginBottom: '0.5rem' }}>Bulk Upload - Regular Photos</h1>
                <p style={{ opacity: 0.7, fontSize: '0.95rem' }}>
                    Upload multiple photos and videos without pose challenges
                </p>
                <p style={{ opacity: 0.5, fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Face detection will run automatically in the background
                </p>
            </header>

            {/* File Selection Area */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div
                    className="bulk-drop-zone"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const dt = e.dataTransfer;
                        const files = Array.from(dt.files);
                        handleFileSelect({ target: { files } });
                    }}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                    <h3 style={{ marginBottom: '0.5rem' }}>Drag & drop files here</h3>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1rem' }}>
                        or click to browse
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                    <button className="btn" style={{ marginTop: '1rem' }}>
                        Choose Files
                    </button>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '1rem' }}>
                        Images and videos up to 50MB each
                    </p>
                </div>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>
                            Selected Files ({selectedFiles.length})
                        </h3>
                        {!uploading && (
                            <button
                                onClick={clearAll}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--secondary)',
                                    cursor: 'pointer',
                                    opacity: 0.6,
                                    fontSize: '0.85rem'
                                }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    <div className="file-list">
                        {selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="file-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                    {getFileIcon(file)}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: '500',
                                            fontSize: '0.9rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {file.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                    </div>
                                    {getStatusIcon(file.name)}
                                </div>
                                {!uploading && !uploadProgress[file.name] && (
                                    <button
                                        onClick={() => removeFile(index)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#999',
                                            padding: '0.25rem'
                                        }}
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Upload Progress */}
                    {uploading && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(successCount / totalFiles) * 100}%` }}
                                />
                            </div>
                            <p className="progress-text" style={{ textAlign: 'center' }}>
                                Uploading {successCount} of {totalFiles} files...
                            </p>
                        </div>
                    )}

                    {/* Upload Button */}
                    {!uploading && Object.keys(uploadProgress).length === 0 && (
                        <button
                            onClick={handleUpload}
                            className="btn"
                            style={{ width: '100%', marginTop: '1.5rem' }}
                        >
                            Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                        </button>
                    )}

                    {/* Results Summary */}
                    {uploadResults.length > 0 && !uploading && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--accent)', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>Upload Complete</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                ✓ {uploadResults.filter(r => r.success).length} succeeded
                                {uploadResults.filter(r => !r.success).length > 0 && (
                                    <>, ✗ {uploadResults.filter(r => !r.success).length} failed</>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
