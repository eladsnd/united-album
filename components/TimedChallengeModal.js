"use client";
import { useState, useEffect } from 'react';
import { X, Timer, Zap, Award } from 'lucide-react';
import UploadSection from './UploadSection';

/**
 * Modal for timed challenges with countdown and bonus points
 */
export default function TimedChallengeModal({ challenge, onClose }) {
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });

    useEffect(() => {
        if (!challenge?.endTime) return;

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(challenge.endTime);
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ hours, minutes, seconds, expired: false });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [challenge]);

    if (!challenge) return null;

    const totalPoints = challenge.points + (challenge.bonusPoints || 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="timed-challenge-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Close">
                    <X size={24} />
                </button>

                {/* Header with timer */}
                <div className="modal-header">
                    <div className="timer-section">
                        <Zap size={32} className="zap-icon" />
                        <div className="timer-display">
                            {timeLeft.expired ? (
                                <div className="expired-text">CHALLENGE EXPIRED</div>
                            ) : (
                                <>
                                    <div className="time-blocks">
                                        <div className="time-block">
                                            <span className="time-value">{String(timeLeft.hours).padStart(2, '0')}</span>
                                            <span className="time-label">hours</span>
                                        </div>
                                        <span className="time-separator">:</span>
                                        <div className="time-block">
                                            <span className="time-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
                                            <span className="time-label">min</span>
                                        </div>
                                        <span className="time-separator">:</span>
                                        <div className="time-block">
                                            <span className="time-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
                                            <span className="time-label">sec</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {challenge.bonusPoints > 0 && !timeLeft.expired && (
                        <div className="bonus-badge">
                            <Award size={18} />
                            <span>+{challenge.bonusPoints} BONUS POINTS!</span>
                        </div>
                    )}
                </div>

                {/* Challenge content */}
                <div className="modal-body">
                    <h2 className="challenge-title">{challenge.title}</h2>
                    <p className="challenge-instruction">{challenge.instruction}</p>

                    {challenge.image && (
                        <div className="challenge-image-container">
                            <img
                                src={challenge.image}
                                alt={challenge.title}
                                className="challenge-image"
                            />
                        </div>
                    )}

                    {/* Points info */}
                    <div className="points-info">
                        <div className="points-breakdown">
                            <span>Base points: {challenge.points}</span>
                            {challenge.bonusPoints > 0 && !timeLeft.expired && (
                                <>
                                    <span>+</span>
                                    <span className="bonus-text">Bonus: {challenge.bonusPoints}</span>
                                    <span>=</span>
                                    <span className="total-points">Total: {totalPoints} points</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Upload section */}
                    {!timeLeft.expired && (
                        <div className="upload-container">
                            <UploadSection folderId={challenge.folderId} poseTitle={challenge.title} />
                        </div>
                    )}
                </div>

                <style jsx>{`
                    .modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2000;
                        padding: 1rem;
                        animation: fadeIn 0.3s ease;
                    }

                    .timed-challenge-modal {
                        background: linear-gradient(135deg, #ffffff 0%, #fef5e7 100%);
                        border-radius: 24px;
                        max-width: 600px;
                        width: 100%;
                        max-height: 90vh;
                        overflow-y: auto;
                        position: relative;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                        animation: slideUp 0.3s ease;
                    }

                    .modal-close {
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        background: rgba(255, 255, 255, 0.9);
                        border: none;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        z-index: 10;
                    }

                    .modal-close:hover {
                        background: white;
                        transform: scale(1.1);
                    }

                    .modal-header {
                        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                        color: white;
                        padding: 2rem;
                        border-radius: 24px 24px 0 0;
                    }

                    .timer-section {
                        display: flex;
                        align-items: center;
                        gap: 1.5rem;
                        margin-bottom: 1rem;
                    }

                    .zap-icon {
                        animation: zap 1s infinite;
                    }

                    .timer-display {
                        flex: 1;
                    }

                    .time-blocks {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    }

                    .time-block {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 12px;
                        padding: 0.75rem 1rem;
                        min-width: 70px;
                    }

                    .time-value {
                        font-size: 2rem;
                        font-weight: 700;
                        font-family: 'Courier New', monospace;
                    }

                    .time-label {
                        font-size: 0.7rem;
                        opacity: 0.9;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }

                    .time-separator {
                        font-size: 2rem;
                        font-weight: 700;
                        opacity: 0.6;
                    }

                    .expired-text {
                        font-size: 1.5rem;
                        font-weight: 700;
                        text-align: center;
                        padding: 1rem;
                    }

                    .bonus-badge {
                        background: rgba(255, 215, 0, 0.3);
                        border: 2px solid rgba(255, 215, 0, 0.6);
                        border-radius: 50px;
                        padding: 0.5rem 1rem;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-weight: 700;
                        font-size: 0.9rem;
                        animation: glow 2s infinite;
                    }

                    .modal-body {
                        padding: 2rem;
                    }

                    .challenge-title {
                        font-family: 'Playfair Display', serif;
                        font-size: 2rem;
                        font-weight: 600;
                        color: #2c3e50;
                        margin-bottom: 1rem;
                        text-align: center;
                    }

                    .challenge-instruction {
                        font-size: 1.1rem;
                        color: #555;
                        text-align: center;
                        margin-bottom: 2rem;
                        line-height: 1.6;
                    }

                    .challenge-image-container {
                        border-radius: 16px;
                        overflow: hidden;
                        margin-bottom: 2rem;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    }

                    .challenge-image {
                        width: 100%;
                        height: auto;
                        display: block;
                    }

                    .points-info {
                        background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
                        border-radius: 12px;
                        padding: 1rem;
                        margin-bottom: 2rem;
                    }

                    .points-breakdown {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.75rem;
                        font-weight: 600;
                        color: #2c3e50;
                        flex-wrap: wrap;
                    }

                    .bonus-text {
                        color: #e74c3c;
                    }

                    .total-points {
                        font-size: 1.2rem;
                        color: #27ae60;
                    }

                    .upload-container {
                        margin-top: 2rem;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes slideUp {
                        from {
                            transform: translateY(30px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }

                    @keyframes zap {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.2); }
                    }

                    @keyframes glow {
                        0%, 100% {
                            box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
                        }
                        50% {
                            box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
                        }
                    }

                    @media (max-width: 768px) {
                        .timed-challenge-modal {
                            max-height: 95vh;
                        }

                        .modal-header {
                            padding: 1.5rem;
                        }

                        .modal-body {
                            padding: 1.5rem;
                        }

                        .time-block {
                            min-width: 60px;
                            padding: 0.5rem 0.75rem;
                        }

                        .time-value {
                            font-size: 1.5rem;
                        }

                        .challenge-title {
                            font-size: 1.5rem;
                        }

                        .timer-section {
                            flex-direction: column;
                            gap: 1rem;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
