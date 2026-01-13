"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function AlbumGallery() {
    const [photos, setPhotos] = useState([]);
    const [faceFilter, setFaceFilter] = useState('all');
    const [poseFilter, setPoseFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchPhotos = async () => {
        try {
            const res = await fetch('/api/photos');
            const data = await res.json();
            setPhotos(data);
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

    const uniqueFaces = [...new Set(photos.map(p => p.faceId).filter(Boolean))];
    const uniquePoses = [...new Set(photos.map(p => p.poseId).filter(Boolean))];

    const filteredPhotos = photos.filter(p => {
        const faceMatch = faceFilter === 'all' || p.faceId === faceFilter;
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
                    <div className="filter-chips">
                        <button className={`chip ${faceFilter === 'all' ? 'active' : ''}`} onClick={() => setFaceFilter('all')}>All Faces</button>
                        {uniqueFaces.map(faceId => (
                            <button
                                key={faceId}
                                className={`chip ${faceFilter === faceId ? 'active' : ''}`}
                                onClick={() => setFaceFilter(faceId)}
                            >
                                {faceId}
                            </button>
                        ))}
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
