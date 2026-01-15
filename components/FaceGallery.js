"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import challengesData from '../data/challenges.json';
import { Download, Heart, Loader2 } from 'lucide-react';

// Skeleton loader component
function GallerySkeleton() {
    return (
        <div className="gallery-grid">
            {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton-card">
                    <div className="skeleton-image pulse"></div>
                </div>
            ))}
        </div>
    );
}

export default function AlbumGallery() {
    const [photos, setPhotos] = useState([]);
    const [faceThumbnails, setFaceThumbnails] = useState([]);
    const [faceFilter, setFaceFilter] = useState('all');
    const [poseFilter, setPoseFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [faceScrollIndex, setFaceScrollIndex] = useState(0);
    const [imageErrors, setImageErrors] = useState({});
    const [likedPhotos, setLikedPhotos] = useState(new Set());
    const [downloading, setDownloading] = useState(false);
    const [deletingPhotos, setDeletingPhotos] = useState(new Set()); // Track photos being deleted

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
        const uploaderId = getUploaderId();

        // If not admin and no uploaderId, show helpful message
        if (!adminMode && !uploaderId) {
            alert('You need to upload at least one photo before you can delete photos. This helps us verify photo ownership.');
            return;
        }

        const confirmMsg = adminMode
            ? 'ADMIN: Permanently delete this photo from Google Drive and the album?'
            : 'Permanently delete this photo from Google Drive and the album?';

        if (!confirm(confirmMsg)) {
            return;
        }

        // Optimistic UI: Immediately mark as deleting
        setDeletingPhotos(prev => new Set([...prev, photoId]));

        const adminToken = getAdminToken();

        try {
            const headers = {};
            if (adminToken) {
                headers['Authorization'] = `Bearer ${adminToken}`;
            }

            // Build URL with uploaderId only if it exists
            const url = uploaderId
                ? `/api/delete-photo?photoId=${photoId}&uploaderId=${uploaderId}`
                : `/api/delete-photo?photoId=${photoId}`;

            const res = await fetch(url, {
                method: 'DELETE',
                headers
            });

            if (res.ok) {
                console.log('[FaceGallery] Photo deleted successfully');
                // Remove from deleting set and refresh
                setDeletingPhotos(prev => {
                    const next = new Set(prev);
                    next.delete(photoId);
                    return next;
                });
                fetchPhotos(); // Refresh gallery
            } else {
                const error = await res.json();
                setDeletingPhotos(prev => {
                    const next = new Set(prev);
                    next.delete(photoId);
                    return next;
                });
                alert('Failed to delete photo: ' + error.error);
            }
        } catch (err) {
            console.error('[FaceGallery] Delete failed:', err);
            setDeletingPhotos(prev => {
                const next = new Set(prev);
                next.delete(photoId);
                return next;
            });
            alert('Failed to delete photo');
        }
    };

    useEffect(() => {
        fetchPhotos();
        window.addEventListener('photoUploaded', fetchPhotos);
        return () => window.removeEventListener('photoUploaded', fetchPhotos);
    }, []);

    // Load liked photos from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('likedPhotos');
        if (saved) {
            try {
                setLikedPhotos(new Set(JSON.parse(saved)));
            } catch (e) {
                console.error('Failed to load likes:', e);
            }
        }
    }, []);

    const toggleLike = (photoId) => {
        setLikedPhotos(prev => {
            const next = new Set(prev);
            if (next.has(photoId)) {
                next.delete(photoId);
            } else {
                next.add(photoId);
            }
            // Save to localStorage
            localStorage.setItem('likedPhotos', JSON.stringify([...next]));
            return next;
        });
    };

    const isLiked = (photoId) => likedPhotos.has(photoId);

    const handleDownloadAlbum = async () => {
        setDownloading(true);

        try {
            const photoIds = filteredPhotos.map(p => p.id);

            const res = await fetch('/api/download-album', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoIds }),
            });

            if (!res.ok) throw new Error('Download failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `united-album-${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download album');
        } finally {
            setDownloading(false);
        }
    };

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
                <GallerySkeleton />
            ) : filteredPhotos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                    <p>No photos yet. Be the first to capture a moment!</p>
                </div>
            ) : (
                <>
                    <div className="gallery-actions">
                        <button
                            className="btn"
                            onClick={handleDownloadAlbum}
                            disabled={downloading || filteredPhotos.length === 0}
                        >
                            {downloading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Creating ZIP...
                                </>
                            ) : (
                                <>
                                    <Download size={20} />
                                    Download Album ({filteredPhotos.length} photos)
                                </>
                            )}
                        </button>
                    </div>
                    <div className="gallery-grid">
                    {filteredPhotos.map(photo => {
                        const uploaderId = getUploaderId();
                        const adminMode = isAdmin();
                        const isOwner = uploaderId && photo.uploaderId === uploaderId;
                        const canDelete = adminMode || isOwner;
                        const isDeleting = deletingPhotos.has(photo.id);

                        return (
                        <div key={photo.id} className={`photo-card ${isDeleting ? 'deleting' : ''}`}>
                            {isDeleting && (
                                <div className="delete-overlay">
                                    <Loader2 className="animate-spin" size={32} />
                                </div>
                            )}
                            {canDelete && !isDeleting && (
                                <button
                                    className={`delete-photo-btn ${adminMode ? 'admin-delete' : ''}`}
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    aria-label={adminMode ? "Admin: Delete any photo" : "Delete your photo"}
                                    title={adminMode ? "Admin: Delete any photo" : "Delete your photo"}
                                >
                                    ✕
                                </button>
                            )}
                            <a
                                href={`/api/download/${photo.driveId}`}
                                download
                                className="download-photo-btn"
                                aria-label="Download photo"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Download size={18} />
                            </a>
                            <button
                                className={`like-photo-btn ${isLiked(photo.id) ? 'liked' : ''}`}
                                onClick={() => toggleLike(photo.id)}
                                aria-label={isLiked(photo.id) ? "Unlike photo" : "Like photo"}
                            >
                                <Heart size={20} fill={isLiked(photo.id) ? 'currentColor' : 'none'} />
                            </button>
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
                </>
            )}
        </div>
    );
}
