"use client";
import { useState, useEffect } from 'react';
import { Timer, Zap } from 'lucide-react';

/**
 * Floating notification badge for active timed challenges
 * Pulses and shows countdown timer
 */
export default function ActiveChallengeNotification({ challenge, onClick }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!challenge?.endTime) return;

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(challenge.endTime);
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('EXPIRED');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m`);
            } else if (minutes > 0) {
                setTimeLeft(`${minutes}m ${seconds}s`);
            } else {
                setTimeLeft(`${seconds}s`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [challenge]);

    if (!challenge) return null;

    return (
        <button
            className="active-challenge-badge"
            onClick={onClick}
            aria-label="View active challenge"
        >
            <div className="badge-content">
                <div className="badge-icon">
                    <Zap size={24} fill="currentColor" />
                </div>
                <div className="badge-text">
                    <div className="badge-title">LIVE CHALLENGE!</div>
                    <div className="badge-timer">
                        <Timer size={14} />
                        <span>{timeLeft}</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .active-challenge-badge {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    padding: 1rem 1.5rem;
                    box-shadow: 0 8px 32px rgba(255, 107, 107, 0.4);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    animation: pulse 2s infinite;
                    z-index: 1000;
                }

                .active-challenge-badge:hover {
                    transform: translateY(-4px) scale(1.05);
                    box-shadow: 0 12px 48px rgba(255, 107, 107, 0.6);
                }

                .badge-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .badge-icon {
                    animation: zap 1s infinite;
                }

                .badge-text {
                    text-align: left;
                }

                .badge-title {
                    font-weight: 700;
                    font-size: 0.9rem;
                    letter-spacing: 1px;
                    margin-bottom: 0.25rem;
                }

                .badge-timer {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    opacity: 0.95;
                }

                @keyframes pulse {
                    0%, 100% {
                        box-shadow: 0 8px 32px rgba(255, 107, 107, 0.4);
                    }
                    50% {
                        box-shadow: 0 8px 32px rgba(255, 107, 107, 0.8),
                                    0 0 0 8px rgba(255, 107, 107, 0.1),
                                    0 0 0 16px rgba(255, 107, 107, 0.05);
                    }
                }

                @keyframes zap {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.2);
                    }
                }

                @media (max-width: 768px) {
                    .active-challenge-badge {
                        bottom: 1rem;
                        right: 1rem;
                        padding: 0.75rem 1rem;
                    }

                    .badge-title {
                        font-size: 0.8rem;
                    }

                    .badge-timer {
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </button>
    );
}
