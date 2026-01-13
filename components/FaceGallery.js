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
            <h2 style={{ fontWeight: '400', marginBottom: '1.5rem' }}>Album Gallery</h2>

            <div className="filters" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.5rem' }}>Filter by Pose</p>
                    <div className="filter-chips" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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

                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.5rem' }}>Filter by Face</p>
                    <div className="filter-chips" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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

            <div className="grid">
                {loading ? (
                    <p>Loading your moments...</p>
                ) : filteredPhotos.length === 0 ? (
                    <p style={{ opacity: 0.5 }}>No photos yet. Be the first!</p>
                ) : (
                    filteredPhotos.map(photo => (
                        <div key={photo.id} className="photo-item">
                            <Image
                                src={photo.url && photo.url !== '#' ? photo.url : '/challenges/dip.png'}
                                alt="Wedding Photo"
                                width={150}
                                height={150}
                                style={{ objectFit: 'cover', borderRadius: '8px' }}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
