"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function FaceGallery() {
    const [photos, setPhotos] = useState([]);
    const [filter, setFilter] = useState('all');
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
        // Refresh periodically or on custom event
        window.addEventListener('photoUploaded', fetchPhotos);
        return () => window.removeEventListener('photoUploaded', fetchPhotos);
    }, []);

    const uniqueFaces = [...new Set(photos.map(p => p.faceId))];

    const filteredPhotos = filter === 'all'
        ? photos
        : photos.filter(p => p.faceId === filter);

    return (
        <div className="face-gallery card" style={{ marginTop: '2rem' }}>
            <h2 style={{ fontWeight: '400', marginBottom: '1.5rem' }}>Photos by Face</h2>

            <div className="filter-chips" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button
                    className={`chip ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All Photos
                </button>
                {uniqueFaces.map(faceId => (
                    <button
                        key={faceId}
                        className={`chip ${filter === faceId ? 'active' : ''}`}
                        onClick={() => setFilter(faceId)}
                    >
                        {faceId === 'face_1' ? 'Person A' : faceId === 'face_2' ? 'Person B' : `Face ${faceId}`}
                    </button>
                ))}
            </div>

            <div className="grid">
                {loading ? (
                    <p>Loading your moments...</p>
                ) : filteredPhotos.length === 0 ? (
                    <p style={{ opacity: 0.5 }}>No photos yet. Be the first!</p>
                ) : (
                    filteredPhotos.map(photo => (
                        <div key={photo.id} className="photo-item">
                            {/* Note: In a real app, this URL would be from Drive or a local proxy */}
                            <Image src={photo.url || '/challenges/dip.png'} alt="Wedding Photo" width={150} height={150} style={{ objectFit: 'cover', borderRadius: '8px' }} />
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
        .filter-chips {
          justify-content: center;
        }
        .chip {
          padding: 0.4rem 1rem;
          border-radius: 20px;
          border: 1px solid #d4af37;
          background: none;
          color: #d4af37;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chip.active {
          background: #d4af37;
          color: white;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 1rem;
        }
        .photo-item {
          aspect-ratio: 1/1;
          background: #eee;
          border-radius: 8px;
          overflow: hidden;
        }
      `}</style>
        </div>
    );
}
