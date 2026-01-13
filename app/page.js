"use client";
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PoseCard from '../components/PoseCard';
import UploadSection from '../components/UploadSection';
import MobileAccessQR from '../components/MobileAccessQR';
import AlbumGallery from '../components/FaceGallery';
import Sidebar from '../components/Sidebar';
import challengesData from '../data/challenges.json';

export default function Home() {
    const [activeSection, setActiveSection] = useState('challenge');
    const [currentIndex, setCurrentIndex] = useState(-1);

    useEffect(() => {
        // Pick a random starting index on load
        const randomIndex = Math.floor(Math.random() * challengesData.length);
        setCurrentIndex(randomIndex);
    }, []);

    const nextChallenge = () => {
        setCurrentIndex((prev) => (prev + 1) % challengesData.length);
    };

    const prevChallenge = () => {
        setCurrentIndex((prev) => (prev - 1 + challengesData.length) % challengesData.length);
    };

    const challenge = currentIndex >= 0 ? challengesData[currentIndex] : null;

    return (
        <div className="app-layout">
            <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />

            <main>
                {activeSection === 'challenge' && (
                    <section className="animate-in">
                        <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                            <h1 style={{ fontSize: '2.5rem', letterSpacing: '2px', fontWeight: '400' }}>UNITED ALBUM</h1>
                            <p style={{ fontStyle: 'italic', color: '#d4af37' }}>Capture your favorite moments</p>
                        </header>

                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontWeight: '400', marginBottom: '2rem' }}>Pick a Pose Challenge</h2>
                            <div className="pose-grid">
                                {challengesData.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`pose-item ${challenge?.id === item.id ? 'active' : ''}`}
                                        onClick={() => setCurrentIndex(challengesData.indexOf(item))}
                                    >
                                        <PoseCard challenge={item} compact={true} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {challenge && (
                            <div className="card upload-area">
                                <h2 style={{ fontWeight: '400' }}>Upload for "{challenge.title}"</h2>
                                <UploadSection folderId={challenge.folderId} poseTitle={challenge.title} />
                            </div>
                        )}
                    </section>
                )}

                {activeSection === 'gallery' && (
                    <section className="animate-in">
                        <AlbumGallery />
                    </section>
                )}

                {activeSection === 'access' && (
                    <section className="animate-in">
                        <MobileAccessQR />
                    </section>
                )}

                <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
                    &copy; 2026 United Album. All rights reserved.
                </footer>
            </main>
        </div>
    );
}
