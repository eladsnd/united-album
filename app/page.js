"use client";
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PoseCard from '../components/PoseCard';
import UploadSection from '../components/UploadSection';
import MobileAccessQR from '../components/MobileAccessQR';
import FaceGallery from '../components/FaceGallery';
import challengesData from '../data/challenges.json';

export default function Home() {
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
        <main>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', letterSpacing: '2px', fontWeight: '400' }}>UNITED ALBUM</h1>
                <p style={{ fontStyle: 'italic', color: '#d4af37' }}>Capture your favorite moments</p>
            </header>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontWeight: '400' }}>Challenge {currentIndex + 1} of {challengesData.length}</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="nav-btn" onClick={prevChallenge} aria-label="Previous Challenge">
                            <ChevronLeft size={20} />
                        </button>
                        <button className="nav-btn" onClick={nextChallenge} aria-label="Next Challenge">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {challenge && (
                    <PoseCard challenge={challenge} />
                )}

                <UploadSection />
            </div>

            <FaceGallery />

            <MobileAccessQR />

            <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
                &copy; 2026 United Album. All rights reserved.
            </footer>

            <style jsx>{`
                .nav-btn {
                    background: var(--accent);
                    border: 1px solid var(--glass-border);
                    color: var(--primary);
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .nav-btn:hover {
                    background: var(--primary);
                    color: white;
                    transform: scale(1.1);
                }
            `}</style>
        </main>
    );
}
