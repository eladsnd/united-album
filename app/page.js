"use client";
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PoseCard from '../components/PoseCard';
import UploadSection from '../components/UploadSection';
import MobileAccessQR from '../components/MobileAccessQR';
import AlbumGallery from '../components/FaceGallery';
import Sidebar from '../components/Sidebar';

export default function Home() {
    const [activeSection, setActiveSection] = useState('challenge');
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [challengesData, setChallengesData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch challenges from database API
    useEffect(() => {
        async function fetchChallenges() {
            try {
                const response = await fetch('/api/admin/poses');
                const data = await response.json();
                if (data.success && data.data) {
                    setChallengesData(data.data);
                    // Pick a random starting index after data is loaded
                    if (data.data.length > 0) {
                        const randomIndex = Math.floor(Math.random() * data.data.length);
                        setCurrentIndex(randomIndex);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch challenges:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchChallenges();
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

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#d4af37' }}>
                                Loading pose challenges...
                            </div>
                        ) : challengesData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem' }}>
                                <p>No pose challenges available yet.</p>
                                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '1rem' }}>
                                    Admin can add poses at /admin
                                </p>
                            </div>
                        ) : (
                            <div className="pose-carousel-container">
                            <h2 style={{ fontWeight: '400', marginBottom: '3rem', textAlign: 'center', letterSpacing: '1px' }}>Pick a Pose Challenge</h2>

                            <div className="carousel-wrapper">
                                <button className="carousel-nav prev" onClick={prevChallenge} aria-label="Previous Challenge">
                                    <ChevronLeft size={32} />
                                </button>

                                <div className="carousel-track-container">
                                    <div className="carousel-track">
                                        {challengesData.map((item, index) => {
                                            const len = challengesData.length;
                                            const isActive = index === currentIndex;
                                            const isPrev = index === (currentIndex - 1 + len) % len;
                                            const isNext = index === (currentIndex + 1) % len;

                                            // Only render the 3 focused items
                                            if (!isActive && !isPrev && !isNext) return null;

                                            let role = "";
                                            if (isActive) role = "active";
                                            else if (isPrev) role = "prev-item";
                                            else if (isNext) role = "next-item";

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`carousel-item ${role}`}
                                                    onClick={() => {
                                                        if (isPrev) prevChallenge();
                                                        if (isNext) nextChallenge();
                                                    }}
                                                >
                                                    <PoseCard challenge={item} compact={!isActive} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button className="carousel-nav next" onClick={nextChallenge} aria-label="Next Challenge">
                                    <ChevronRight size={32} />
                                </button>
                            </div>
                        </div>

                        {challenge && (
                            <div className="card upload-area">
                                <h2 style={{ fontWeight: '400' }}>Upload for "{challenge.title}"</h2>
                                <UploadSection folderId={challenge.folderId} poseTitle={challenge.title} />
                            </div>
                        )}
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
