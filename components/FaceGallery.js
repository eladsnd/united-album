"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import challengesData from '../data/challenges.json';
import { Download, Heart, Loader2 } from 'lucide-react';
import { getUserId } from '../lib/utils/getUserId';
import ImageModal from './ImageModal';

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
    const [likeFilter, setLikeFilter] = useState('all'); // 'all' or 'liked'
    const [loading, setLoading] = useState(true);
    const [faceScrollIndex, setFaceScrollIndex] = useState(0);
    const [imageErrors, setImageErrors] = useState({});
    const [likedPhotos, setLikedPhotos] = useState(new Set());
    const [likeCounts, setLikeCounts] = useState({}); // { photoId: count }
    const [modalImage, setModalImage] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [deletingPhotos, setDeletingPhotos] = useState(new Set()); // Track photos being deleted
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchPhotos = async () => {
        try {
            const res = await fetch('/api/photos?page=1&limit=20');
            const data = await res.json();
            const photosArray = data.photos || data; // Handle both new and old response formats
            setPhotos(photosArray);
            setHasMore(data.pagination?.hasMore || false);

            // Initialize like counts from photo data
            const counts = {};
            photosArray.forEach(photo => {
                counts[photo.id] = photo.likeCount || 0;
            });
            setLikeCounts(counts);

            // Fetch face thumbnails
            const facesRes = await fetch('/api/face-thumbnails');
            const facesData = await facesRes.json();
            console.log('[FaceGallery] Face thumbnails:', facesData);
            setFaceThumbnails(facesData);

            // Fetch liked status for current user
            const userId = getUserId();
            if (userId) {
                const likedSet = new Set();
                await Promise.all(
                    photosArray.map(async (photo) => {
                        try {
                            const likeRes = await fetch(`/api/photos/${photo.id}/like?userId=${userId}`);
                            const likeData = await likeRes.json();
                            if (likeData.liked) {
                                likedSet.add(photo.id);
                            }
                        } catch (err) {
                            console.error(`Failed to fetch like status for photo ${photo.id}:`, err);
                        }
                    })
                );
                setLikedPhotos(likedSet);
            }
        } catch (err) {
            console.error('Failed to fetch photos:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const res = await fetch(`/api/photos?page=${nextPage}&limit=20`);
            const data = await res.json();
            const newPhotos = data.photos || [];

            // Append new photos to existing array
            setPhotos(prev => [...prev, ...newPhotos]);
            setCurrentPage(nextPage);
            setHasMore(data.pagination?.hasMore || false);

            // Update like counts for new photos
            const counts = {};
            newPhotos.forEach(photo => {
                counts[photo.id] = photo.likeCount || 0;
            });
            setLikeCounts(prev => ({ ...prev, ...counts }));

            // Fetch liked status for new photos
            const userId = getUserId();
            if (userId) {
                const newLikedSet = new Set(likedPhotos);
                await Promise.all(
                    newPhotos.map(async (photo) => {
                        try {
                            const likeRes = await fetch(`/api/photos/${photo.id}/like?userId=${userId}`);
                            const likeData = await likeRes.json();
                            if (likeData.liked) {
                                newLikedSet.add(photo.id);
                            }
                        } catch (err) {
                            console.error(`Failed to fetch like status for photo ${photo.id}:`, err);
                        }
                    })
                );
                setLikedPhotos(newLikedSet);
            }
        } catch (err) {
            console.error('Failed to load more photos:', err);
        } finally {
            setLoadingMore(false);
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

    // Infinite scroll effect
    useEffect(() => {
        const handleScroll = () => {
            if (loadingMore || !hasMore) return;

            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop;
            const clientHeight = document.documentElement.clientHeight;

            // Trigger load more when scrolled to 80% of page
            if (scrollTop + clientHeight >= scrollHeight * 0.8) {
                loadMore();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loadingMore, hasMore, currentPage]);

    const toggleLike = async (photoId) => {
        const userId = getUserId();
        if (!userId) {
            console.error('[FaceGallery] No user ID available');
            return;
        }

        try {
            const res = await fetch(`/api/photos/${photoId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (!res.ok) {
                throw new Error('Failed to toggle like');
            }

            const { liked, likeCount } = await res.json();

            // Update local state
            setLikedPhotos(prev => {
                const next = new Set(prev);
                if (liked) {
                    next.add(photoId);
                } else {
                    next.delete(photoId);
                }
                return next;
            });

            // Update like count
            setLikeCounts(prev => ({
                ...prev,
                [photoId]: likeCount
            }));

        } catch (err) {
            console.error('[FaceGallery] Failed to toggle like:', err);
        }
    };

    const isLiked = (photoId) => likedPhotos.has(photoId);
    const getLikeCount = (photoId) => likeCounts[photoId] || 0;

    // Calculate smart object-position based on face locations
    const getObjectPosition = (faceBoxes) => {
        if (!faceBoxes || faceBoxes.length === 0) {
            return 'center center'; // Default for photos without faces
        }

        try {
            const boxes = typeof faceBoxes === 'string' ? JSON.parse(faceBoxes) : faceBoxes;
            if (!Array.isArray(boxes) || boxes.length === 0) {
                return 'center center';
            }

            // Calculate center of all faces (weighted average)
            let totalX = 0;
            let totalY = 0;
            let totalWeight = 0;

            boxes.forEach(box => {
                if (box && box.x !== undefined && box.y !== undefined && box.width && box.height) {
                    const faceArea = box.width * box.height;
                    const faceCenterX = box.x + (box.width / 2);
                    const faceCenterY = box.y + (box.height / 2);

                    totalX += faceCenterX * faceArea;
                    totalY += faceCenterY * faceArea;
                    totalWeight += faceArea;
                }
            });

            if (totalWeight === 0) {
                return 'center center';
            }

            const avgX = totalX / totalWeight;
            const avgY = totalY / totalWeight;

            // Convert to percentage (0-100%)
            // Clamp between 20% and 80% to avoid extreme edges
            const xPercent = Math.max(20, Math.min(80, avgX));
            const yPercent = Math.max(20, Math.min(80, avgY));

            return `${xPercent}% ${yPercent}%`;
        } catch (err) {
            console.error('[FaceGallery] Error calculating object position:', err);
            return 'center center';
        }
    };

    const handleDownloadAlbum = async (downloadType = 'filtered') => {
        setDownloading(true);

        try {
            let photoIds;
            let filename;

            if (downloadType === 'liked') {
                photoIds = Array.from(likedPhotos);
                if (photoIds.length === 0) {
                    alert('No liked photos to download. Like some photos first!');
                    setDownloading(false);
                    return;
                }
                filename = `liked-photos-${Date.now()}.zip`;
            } else {
                photoIds = filteredPhotos.map(p => p.id);
                filename = `united-album-${Date.now()}.zip`;
            }

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
            a.download = filename;
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
        const likeMatch = likeFilter === 'all' || likedPhotos.has(p.id);
        return faceMatch && poseMatch && likeMatch;
    });

    return (
        <div className="face-gallery card" style={{ marginTop: '2rem' }}>
            <h2 style={{ fontWeight: '400', marginBottom: '2rem', fontFamily: "'Playfair Display', serif" }}>Album Gallery</h2>

            <div className="filter-container">
                <div className="filter-group">
                    <span className="filter-label">Filter by Likes</span>
                    <div className="filter-chips">
                        <button className={`chip ${likeFilter === 'all' ? 'active' : ''}`} onClick={() => setLikeFilter('all')}>
                            All Photos
                        </button>
                        <button className={`chip ${likeFilter === 'liked' ? 'active' : ''}`} onClick={() => setLikeFilter('liked')}>
                            ❤️ Liked ({likedPhotos.size})
                        </button>
                    </div>
                </div>

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
                            onClick={() => handleDownloadAlbum('filtered')}
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
                                    Download Current View ({filteredPhotos.length} photos)
                                </>
                            )}
                        </button>

                        {likedPhotos.size > 0 && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleDownloadAlbum('liked')}
                                disabled={downloading}
                                style={{ background: '#ef4444', borderColor: '#ef4444', color: 'white' }}
                            >
                                {downloading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Creating ZIP...
                                    </>
                                ) : (
                                    <>
                                        <Heart size={20} fill="white" />
                                        Download Liked ({likedPhotos.size} photos)
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    <div className="gallery-grid">
                    {filteredPhotos.map(photo => {
                        const uploaderId = getUploaderId();
                        const adminMode = isAdmin();
                        const isOwner = uploaderId && photo.uploaderId === uploaderId;
                        const canDelete = adminMode || isOwner;
                        const isDeleting = deletingPhotos.has(photo.id);

                        return (
                        <div
                            key={photo.id}
                            className={`photo-card ${isDeleting ? 'deleting' : ''}`}
                            onClick={() => setModalImage({ url: photo.url, downloadUrl: `/api/download/${photo.driveId}` })}
                            style={{ cursor: 'pointer' }}
                        >
                            {isDeleting && (
                                <div className="delete-overlay">
                                    <Loader2 className="animate-spin" size={32} />
                                </div>
                            )}
                            {canDelete && !isDeleting && (
                                <button
                                    className={`delete-photo-btn ${adminMode ? 'admin-delete' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePhoto(photo.id);
                                    }}
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLike(photo.id);
                                }}
                                aria-label={isLiked(photo.id) ? "Unlike photo" : "Like photo"}
                            >
                                <Heart size={20} fill={isLiked(photo.id) ? 'currentColor' : 'none'} />
                                {getLikeCount(photo.id) > 0 && (
                                    <span className="like-count">{getLikeCount(photo.id)}</span>
                                )}
                            </button>
                            <Image
                                src={photo.url && photo.url !== '#' ? photo.url : '/challenges/dip.png'}
                                alt="Wedding Photo"
                                fill
                                unoptimized={true}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="gallery-image"
                                style={{
                                    objectPosition: getObjectPosition(photo.faceBoxes)
                                }}
                            />
                            <div className="photo-info">
                                <div>{photo.poseId}</div>
                                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{new Date(photo.timestamp).toLocaleDateString()}</div>
                            </div>
                        </div>
                        );
                    })}
                </div>
                {loadingMore && (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Loader2 className="animate-spin" size={32} style={{ display: 'inline-block' }} />
                        <p style={{ marginTop: '1rem', opacity: 0.7 }}>Loading more photos...</p>
                    </div>
                )}
                {!loadingMore && !hasMore && filteredPhotos.length > 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                        <p>You've reached the end!</p>
                    </div>
                )}
                </>
            )}

            {modalImage && (
                <ImageModal
                    imageUrl={modalImage.url}
                    altText="Wedding Photo"
                    downloadUrl={modalImage.downloadUrl}
                    onClose={() => setModalImage(null)}
                />
            )}
        </div>
    );
}
