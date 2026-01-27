"use client";
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PoseCard from '../components/PoseCard';
import UploadSection from '../components/UploadSection';
import MobileAccessQR from '../components/MobileAccessQR';
import AlbumGallery from '../components/FaceGallery';
import Sidebar from '../components/Sidebar';
import ImageModal from '../components/ImageModal';
import BulkUpload from '../components/BulkUpload';
import BackgroundFaceProcessor from '../components/BackgroundFaceProcessor';
import ActiveChallengeNotification from '../components/ActiveChallengeNotification';
import TimedChallengeModal from '../components/TimedChallengeModal';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlag';

export default function Home() {
    const { flags } = useFeatureFlags();

    // Default to gallery if challenges are disabled, otherwise challenge
    const defaultSection = flags?.challenges ? 'challenge' : 'gallery';
    const [activeSection, setActiveSection] = useState(defaultSection);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [challengesData, setChallengesData] = useState([]);
    const [regularChallenges, setRegularChallenges] = useState([]);
    const [activeTimedChallenge, setActiveTimedChallenge] = useState(null);
    const [showTimedChallengeModal, setShowTimedChallengeModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalImage, setModalImage] = useState(null);

    // Load persisted section from localStorage after hydration
    useEffect(() => {
        const savedSection = localStorage.getItem('activeSection');
        if (savedSection) {
            // Only use saved section if it's allowed by feature flags
            if (savedSection === 'challenge' && !flags?.challenges) {
                setActiveSection('gallery');
            } else {
                setActiveSection(savedSection);
            }
        }
    }, [flags]);

    // Save active section to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('activeSection', activeSection);
    }, [activeSection]);

    // Fetch challenges from database API (only if challenges feature is enabled)
    useEffect(() => {
        async function fetchChallenges() {
            // Skip fetching if challenges are disabled
            if (!flags?.challenges) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/admin/poses');
                const data = await response.json();
                if (data.success && data.data) {
                    const now = new Date();

                    // Separate timed challenges from regular challenges
                    const timed = [];
                    const regular = [];

                    data.data.forEach(challenge => {
                        // A challenge is "timed" if it has both startTime and endTime set
                        const hasTimeWindow = challenge.startTime && challenge.endTime;

                        if (hasTimeWindow) {
                            const start = new Date(challenge.startTime);
                            const end = new Date(challenge.endTime);

                            // Check if challenge is currently active
                            if (now >= start && now <= end) {
                                timed.push(challenge);
                            }
                            // Don't show expired timed challenges
                        } else {
                            // Regular challenge (no time limit)
                            regular.push(challenge);
                        }
                    });

                    setChallengesData(data.data);
                    setRegularChallenges(regular);

                    // Set active timed challenge (take first one if multiple)
                    setActiveTimedChallenge(timed.length > 0 ? timed[0] : null);

                    // Pick a random starting index for regular challenges
                    if (regular.length > 0) {
                        const randomIndex = Math.floor(Math.random() * regular.length);
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

        // Refresh every minute to check for new timed challenges
        const interval = setInterval(fetchChallenges, 60000);
        return () => clearInterval(interval);
    }, [flags]);

    const nextChallenge = () => {
        setCurrentIndex((prev) => (prev + 1) % regularChallenges.length);
    };

    const prevChallenge = () => {
        setCurrentIndex((prev) => (prev - 1 + regularChallenges.length) % regularChallenges.length);
    };

    const challenge = currentIndex >= 0 ? regularChallenges[currentIndex] : null;

    return (
        <div className="app-layout">
            <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
            <BackgroundFaceProcessor />

            <main>
                {activeSection === 'challenge' && (
                    <section className="animate-in">
                        <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                            <h1 style={{
                                fontFamily: "'Great Vibes', cursive",
                                fontSize: '4rem',
                                fontWeight: '400',
                                color: '#d4af37',
                                marginBottom: '0.5rem',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                Shira & Elad's Wedding
                            </h1>
                            <p style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: '1.1rem',
                                letterSpacing: '3px',
                                textTransform: 'uppercase',
                                color: '#2c3e50',
                                fontWeight: '400'
                            }}>
                                United Album
                            </p>
                            <p style={{ fontStyle: 'italic', color: '#d4af37', fontSize: '0.95rem', marginTop: '0.5rem' }}>Capture your favorite moments</p>
                        </header>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#d4af37' }}>
                                Loading pose challenges...
                            </div>
                        ) : regularChallenges.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem' }}>
                                <p>No pose challenges available yet.</p>
                                {activeTimedChallenge && (
                                    <p style={{ marginTop: '1rem', color: '#ff6b6b' }}>
                                        But there's a live timed challenge! Check the notification below.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="pose-carousel-container">
                            <h2 style={{ fontWeight: '400', marginBottom: '3rem', marginTop: '2rem', textAlign: 'center', letterSpacing: '1px', position: 'relative', zIndex: 10 }}>Pick a Pose Challenge</h2>

                            <div className="carousel-wrapper">
                                <button className="carousel-nav prev" onClick={prevChallenge} aria-label="Previous Challenge">
                                    <ChevronLeft size={32} />
                                </button>

                                <div className="carousel-track-container">
                                    <div className="carousel-track">
                                        {regularChallenges.map((item, index) => {
                                            const len = regularChallenges.length;
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
                                                        else if (isNext) nextChallenge();
                                                        else if (isActive) setModalImage({ url: item.image, downloadUrl: null });
                                                    }}
                                                >
                                                    <PoseCard
                                                        challenge={item}
                                                        compact={!isActive}
                                                        onClick={isActive ? (e) => {
                                                            e.stopPropagation();
                                                            setModalImage({ url: item.image, downloadUrl: null });
                                                        } : undefined}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button className="carousel-nav next" onClick={nextChallenge} aria-label="Next Challenge">
                                    <ChevronRight size={32} />
                                </button>
                            </div>

                            {challenge && (
                                <div className="card upload-area" style={{ marginTop: '4rem', clear: 'both' }}>
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

                {activeSection === 'bulk-upload' && (
                    <section className="animate-in">
                        <BulkUpload />
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

            {modalImage && (
                <ImageModal
                    imageUrl={modalImage.url}
                    altText="Pose Challenge"
                    downloadUrl={modalImage.downloadUrl}
                    onClose={() => setModalImage(null)}
                />
            )}

            {/* Active Timed Challenge Notification */}
            {activeTimedChallenge && (
                <ActiveChallengeNotification
                    challenge={activeTimedChallenge}
                    onClick={() => setShowTimedChallengeModal(true)}
                />
            )}

            {/* Timed Challenge Modal */}
            {showTimedChallengeModal && activeTimedChallenge && (
                <TimedChallengeModal
                    challenge={activeTimedChallenge}
                    onClose={() => setShowTimedChallengeModal(false)}
                />
            )}
        </div>
    );
}
