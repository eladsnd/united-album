"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

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
            setFaceThumbnails(facesData);
        } catch (err) {
            console.error('Failed to fetch photos:', err);
        } finally {
            setLoading(false);
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
                        {uniquePoses.map(poseId => (
                            <button
                                key={poseId}
                                className={`chip ${poseFilter === poseId ? 'active' : ''}`}
                                onClick={() => setPoseFilter(poseId)}
                            >
                                {poseId}
                            </button>
                        ))}
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
                                className={`face-thumb ${faceFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setFaceFilter('all')}
                            >
                                <div className="face-thumb-img all-faces">
                                    👥
                                </div>
                                <span className="face-thumb-label">All</span>
                            </button>

                            {faceThumbnails.slice(faceScrollIndex, faceScrollIndex + 5).map(face => {
                                const hasError = imageErrors[face.faceId];
                                const showPlaceholder = !face.faceUrl || hasError;

                                return (
                                    <button
                                        key={face.faceId}
                                        className={`face-thumb ${faceFilter === face.faceId ? 'active' : ''}`}
                                        onClick={() => setFaceFilter(face.faceId)}
                                    >
                                        {!showPlaceholder ? (
                                            <img
                                                src={face.faceUrl}
                                                alt={`Face ${face.faceId}`}
                                                className="face-thumb-img"
                                                onError={() => setImageErrors(prev => ({ ...prev, [face.faceId]: true }))}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="face-thumb-img placeholder">
                                                👤
                                            </div>
                                        )}
                                        <span className="face-thumb-label">{face.faceId}</span>
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
                    {filteredPhotos.map(photo => (
                        <div key={photo.id} className="photo-card">
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
                    ))}
                </div>
            )}
        </div>
    );
}
