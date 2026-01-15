"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import challengesData from '../data/challenges.json';

export default function AlbumGallery() {
    const [photos, setPhotos] = useState([]);
    const [faceThumbnails, setFaceThumbnails] = useState([]);
    const [faceFilter, setFaceFilter] = useState('all');
    const [poseFilter, setPoseFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [faceScrollIndex, setFaceScrollIndex] = useState(0);
    const [imageErrors, setImageErrors] = useState({});

    const fetchPhotos = async () => {
        try {
            const res = await fetch('/api/photos');
            const data = await res.json();
            setPhotos(data);

            // Fetch face thumbnails
            const facesRes = await fetch('/api/face-thumbnails');
            const facesData = await facesRes.json();
            console.log('[FaceGallery] Face thumbnails:', facesData);
            setFaceThumbnails(facesData);
        } catch (err) {
            console.error('Failed to fetch photos:', err);
        } finally {
            setLoading(false);
        }
    };

    const getUploaderId = () => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('uploaderId');
    };

    const getAdminToken = () => {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem('admin_token');
    };

    const isAdmin = () => {
        return !!getAdminToken();
    };

    const handleDeletePhoto = async (photoId) => {
        const adminMode = isAdmin();
        const confirmMsg = adminMode
            ? 'ADMIN: Permanently delete this photo from Google Drive and the album?'
            : 'Permanently delete this photo from Google Drive and the album?';

        if (!confirm(confirmMsg)) {
            return;
        }

        const uploaderId = getUploaderId();
        const adminToken = getAdminToken();

        try {
            const headers = {};
            if (adminToken) {
                headers['Authorization'] = `Bearer ${adminToken}`;
            }

            const res = await fetch(`/api/delete-photo?photoId=${photoId}&uploaderId=${uploaderId || ''}`, {
                method: 'DELETE',
                headers
            });

            if (res.ok) {
                console.log('[FaceGallery] Photo deleted successfully');
                fetchPhotos(); // Refresh gallery
            } else {
                const error = await res.json();
                alert('Failed to delete photo: ' + error.error);
            }
        } catch (err) {
            console.error('[FaceGallery] Delete failed:', err);
            alert('Failed to delete photo');
        }
    };

    useEffect(() => {
        fetchPhotos();
        window.addEventListener('photoUploaded', fetchPhotos);
        return () => window.removeEventListener('photoUploaded', fetchPhotos);
    }, []);

    // Extract unique faces from all photos (use mainFaceId for grouping)
    const allMainFaces = photos.map(p => p.mainFaceId || p.faceId).filter(Boolean);
    const uniqueFaces = [...new Set(allMainFaces)];
    const uniquePoses = [...new Set(photos.map(p => p.poseId).filter(Boolean))]

        ;

    const filteredPhotos = photos.filter(p => {
        // Filter by ANY face in photo (not just main face)
        const faceIds = p.faceIds || [p.mainFaceId || p.faceId || 'unknown'];
        const faceMatch = faceFilter === 'all' || faceIds.includes(faceFilter);
        const poseMatch = poseFilter === 'all' || p.poseId === poseFilter;
        return faceMatch && poseMatch;
    });

    return (
        <div className="face-gallery card" style={{ marginTop: '2rem' }}>
            <h2 style={{ fontWeight: '400', marginBottom: '2rem', fontFamily: "'Playfair Display', serif" }}>Album Gallery</h2>

            <div className="filter-container">
                <div className="filter-group">
                    <span className="filter-label">Filter by Pose</span>
                    <div className="filter-chips">
                        <button className={`chip ${poseFilter === 'all' ? 'active' : ''}`} onClick={() => setPoseFilter('all')}>All Poses</button>
                        {uniquePoses.map(poseId => {
                            // Find the pose title from challenges.json
                            const challenge = challengesData.find(c => c.id === poseId);
                            const displayName = challenge ? challenge.title : poseId;

                            return (
                                <button
                                    key={poseId}
                                    className={`chip ${poseFilter === poseId ? 'active' : ''}`}
                                    onClick={() => setPoseFilter(poseId)}
                                >
                                    {displayName}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Filter by Face</span>
                    <div className="face-thumbnails-container">
                        {faceScrollIndex > 0 && (
                            <button
                                className="scroll-arrow left"
                                onClick={() => setFaceScrollIndex(Math.max(0, faceScrollIndex - 5))}
                            >
                                ‹
                            </button>
                        )}

                        <div className="face-thumbnails">
                            <button
                                className={`face-thumb all-filter ${faceFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setFaceFilter('all')}
                            >
                                <div className="face-thumb-img all-faces">
                                    👥
                                </div>
                                <span className="face-thumb-label">All</span>
                            </button>

                            {faceThumbnails.slice(faceScrollIndex, faceScrollIndex + 5).map(face => {
                                const hasError = imageErrors[face.faceId];
                                const hasFaceUrl = face.faceUrl && face.faceUrl !== '#';

                                // Extract person number for display (person_3 → "3")
                                const personNumber = face.faceId.replace('person_', '');

                                console.log(`[FaceGallery] ${face.faceId}: hasFaceUrl=${hasFaceUrl}, hasError=${hasError}, url=${face.faceUrl}`);

                                return (
                                    <button
                                        key={face.faceId}
                                        className={`face-thumb person-filter ${faceFilter === face.faceId ? 'active' : ''}`}
                                        onClick={() => setFaceFilter(face.faceId)}
                                    >
                                        {hasFaceUrl && !hasError ? (
                                            <img
                                                src={face.faceUrl}
                                                alt={`Person ${personNumber}`}
                                                className="face-thumb-img"
                                                onError={(e) => {
                                                    console.error(`[FaceGallery] Image load error for ${face.faceId}:`, e);
                                                    setImageErrors(prev => ({ ...prev, [face.faceId]: true }));
                                                }}
                                                onLoad={() => console.log(`[FaceGallery] Image loaded successfully: ${face.faceId}`)}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="face-thumb-img placeholder">
                                                👤
                                            </div>
                                        )}
                                        <span className="face-thumb-label">Person {personNumber}</span>
                                        <span className="face-thumb-count">{face.photoCount}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {faceScrollIndex + 5 < faceThumbnails.length && (
                            <button
                                className="scroll-arrow right"
                                onClick={() => setFaceScrollIndex(Math.min(faceThumbnails.length - 5, faceScrollIndex + 5))}
                            >
                                ›
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
                    <p>Loading your moments...</p>
                </div>
            ) : filteredPhotos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                    <p>No photos yet. Be the first to capture a moment!</p>
                </div>
            ) : (
                <div className="gallery-grid">
                    {filteredPhotos.map(photo => {
                        const uploaderId = getUploaderId();
                        const adminMode = isAdmin();
                        const isOwner = uploaderId && photo.uploaderId === uploaderId;
                        const canDelete = adminMode || isOwner;

                        return (
                        <div key={photo.id} className="photo-card">
                            {canDelete && (
                                <button
                                    className={`delete-photo-btn ${adminMode ? 'admin-delete' : ''}`}
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    aria-label={adminMode ? "Admin: Delete any photo" : "Delete your photo"}
                                    title={adminMode ? "Admin: Delete any photo" : "Delete your photo"}
                                >
                                    ✕
                                </button>
                            )}
                            <Image
                                src={photo.url && photo.url !== '#' ? photo.url : '/challenges/dip.png'}
                                alt="Wedding Photo"
                                fill
                                unoptimized={true}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="gallery-image"
                            />
                            <div className="photo-info">
                                <div>{photo.poseId}</div>
                                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{new Date(photo.timestamp).toLocaleDateString()}</div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
