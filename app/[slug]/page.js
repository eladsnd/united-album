/**
 * Event Guest Page (Dynamic Route)
 *
 * Public-facing page for event guests with full site experience.
 * Accessible at /{slug} (e.g., /sarah-john-wedding)
 */

"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PoseCard from '@/components/PoseCard';
import UploadSection from '@/components/UploadSection';
import MobileAccessQR from '@/components/MobileAccessQR';
import AlbumGallery from '@/components/FaceGallery';
import Sidebar from '@/components/Sidebar';
import ImageModal from '@/components/ImageModal';
import BulkUpload from '@/components/BulkUpload';
import BackgroundFaceProcessor from '@/components/BackgroundFaceProcessor';
import ActiveChallengeNotification from '@/components/ActiveChallengeNotification';
import TimedChallengeModal from '@/components/TimedChallengeModal';

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug;

  const [event, setEvent] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Challenge state
  const defaultSection = 'challenge';
  const [activeSection, setActiveSection] = useState(defaultSection);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [challengesData, setChallengesData] = useState([]);
  const [regularChallenges, setRegularChallenges] = useState([]);
  const [activeTimedChallenge, setActiveTimedChallenge] = useState(null);
  const [showTimedChallengeModal, setShowTimedChallengeModal] = useState(false);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);

  useEffect(() => {
    loadEvent();
  }, [slug]);

  const loadEvent = async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/events/by-slug/${slug}`);

      if (res.status === 404) {
        setError('Event not found');
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setEvent(data.event);
      setFeatures(data.features);
      setError(null);
    } catch (err) {
      console.error('[EventPage] Error loading event:', err);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  // Load persisted section from localStorage after hydration
  useEffect(() => {
    const savedSection = localStorage.getItem('activeSection');
    if (savedSection) {
      if (savedSection === 'challenge' && !features?.challenges) {
        setActiveSection('gallery');
      } else {
        setActiveSection(savedSection);
      }
    }
  }, [features]);

  // Save active section to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('activeSection', activeSection);
  }, [activeSection]);

  // Fetch challenges from database API (event-scoped)
  useEffect(() => {
    async function fetchChallenges() {
      if (!features?.challenges || !event?.id) {
        setChallengesLoading(false);
        return;
      }

      try {
        // CRITICAL: Fetch challenges for this event only (global + event-specific)
        const response = await fetch(`/api/admin/poses?eventId=${event.id}`);
        const data = await response.json();
        if (data.success && data.data) {
          const now = new Date();

          const timed = [];
          const regular = [];

          data.data.forEach(challenge => {
            const hasTimeWindow = challenge.startTime && challenge.endTime;

            if (hasTimeWindow) {
              const start = new Date(challenge.startTime);
              const end = new Date(challenge.endTime);

              if (now >= start && now <= end) {
                timed.push(challenge);
              }
            } else {
              regular.push(challenge);
            }
          });

          setChallengesData(data.data);
          setRegularChallenges(regular);
          setActiveTimedChallenge(timed.length > 0 ? timed[0] : null);

          if (regular.length > 0) {
            const randomIndex = Math.floor(Math.random() * regular.length);
            setCurrentIndex(randomIndex);
          }
        }
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
      } finally {
        setChallengesLoading(false);
      }
    }
    fetchChallenges();

    const interval = setInterval(fetchChallenges, 60000);
    return () => clearInterval(interval);
  }, [features, event]); // Load challenges when features and event are available

  const nextChallenge = () => {
    setCurrentIndex((prev) => (prev + 1) % regularChallenges.length);
  };

  const prevChallenge = () => {
    setCurrentIndex((prev) => (prev - 1 + regularChallenges.length) % regularChallenges.length);
  };

  const challenge = currentIndex >= 0 ? regularChallenges[currentIndex] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{error}</h1>
          <p className="text-gray-600 mb-6">The event you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        eventSlug={slug}
        eventName={event.name}
        eventDescription={event.description}
      />
      <BackgroundFaceProcessor />

      <main>
        {activeSection === 'challenge' && (
          <section className="animate-in">
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
              <h1 style={{
                fontFamily: "'Great Vibes', cursive",
                fontSize: '4rem',
                fontWeight: '400',
                color: event.color,
                marginBottom: '0.5rem',
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
              }}>
                {event.name}
              </h1>
              {event.description && (
                <p style={{ fontStyle: 'italic', color: event.color, fontSize: '0.95rem', marginTop: '0.5rem' }}>
                  {event.description}
                </p>
              )}
            </header>

            {challengesLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: event.color }}>
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
                <h2 style={{ fontWeight: '400', marginBottom: '3rem', marginTop: '2rem', textAlign: 'center', letterSpacing: '1px', position: 'relative', zIndex: 10 }}>
                  Pick a Pose Challenge
                </h2>

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
                    <UploadSection
                      folderId={challenge.folderId}
                      poseTitle={challenge.title}
                      eventId={event.id}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeSection === 'gallery' && (
          <section className="animate-in">
            <AlbumGallery eventId={event.id} />
          </section>
        )}

        {activeSection === 'bulk-upload' && (
          <section className="animate-in">
            <BulkUpload eventId={event.id} />
          </section>
        )}

        {activeSection === 'access' && (
          <section className="animate-in">
            <MobileAccessQR />
          </section>
        )}

        <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
          &copy; 2026 {event.name}. All rights reserved.
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

      {activeTimedChallenge && (
        <ActiveChallengeNotification
          challenge={activeTimedChallenge}
          onClick={() => setShowTimedChallengeModal(true)}
        />
      )}

      {showTimedChallengeModal && activeTimedChallenge && (
        <TimedChallengeModal
          challenge={activeTimedChallenge}
          onClose={() => setShowTimedChallengeModal(false)}
        />
      )}
    </div>
  );
}
