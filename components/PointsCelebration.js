"use client";
import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { Trophy, Star, Sparkles } from 'lucide-react';

/**
 * Points Celebration Component
 *
 * Displays fun success animation when user earns points.
 * Features confetti, animated points counter, and celebration modal.
 *
 * Usage:
 * ```jsx
 * <PointsCelebration
 *   show={true}
 *   pointsEarned={25}
 *   bonusPoints={10}
 *   challengeTitle="The Romantic Dip"
 *   totalPoints={100}
 *   isTimedChallenge={true}
 *   onComplete={() => setShowCelebration(false)}
 * />
 * ```
 */
export default function PointsCelebration({
    show,
    pointsEarned,
    bonusPoints = 0,
    challengeTitle,
    totalPoints,
    isTimedChallenge = false,
    onComplete,
}) {
    const [animatedPoints, setAnimatedPoints] = useState(0);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        // Set window size for confetti
        setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (show && pointsEarned > 0) {
            // Animate points counter
            const duration = 1000; // 1 second
            const steps = 30;
            const increment = pointsEarned / steps;
            let current = 0;

            const interval = setInterval(() => {
                current += increment;
                if (current >= pointsEarned) {
                    setAnimatedPoints(pointsEarned);
                    clearInterval(interval);
                } else {
                    setAnimatedPoints(Math.floor(current));
                }
            }, duration / steps);

            // Auto-close after 4 seconds
            const timeout = setTimeout(() => {
                onComplete?.();
            }, 4000);

            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        } else {
            setAnimatedPoints(0);
        }
    }, [show, pointsEarned, onComplete]);

    if (!show) return null;

    const basePoints = pointsEarned - bonusPoints;

    return (
        <>
            {/* Confetti */}
            <Confetti
                width={windowSize.width}
                height={windowSize.height}
                numberOfPieces={200}
                recycle={false}
                gravity={0.3}
            />

            {/* Celebration Modal */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                onClick={onComplete}
            >
                <div
                    className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-bounce-in"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        animation: 'scaleIn 0.5s ease-out',
                    }}
                >
                    {/* Trophy Icon with Glow */}
                    <div className="relative mb-4">
                        <div
                            className="absolute inset-0 blur-xl opacity-50"
                            style={{
                                background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
                            }}
                        ></div>
                        <Trophy
                            size={80}
                            className="mx-auto text-yellow-500 relative z-10 animate-pulse"
                        />
                    </div>

                    {/* Success Message */}
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        Challenge Complete!
                    </h2>
                    <p className="text-lg text-gray-600 mb-6">
                        "{challengeTitle}"
                    </p>

                    {/* Animated Points Display */}
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 mb-4 shadow-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Sparkles className="text-white" size={24} />
                            <span className="text-5xl font-bold text-white">
                                +{animatedPoints}
                            </span>
                            <Star className="text-white" size={24} />
                        </div>
                        <p className="text-white text-sm font-semibold">POINTS EARNED</p>

                        {/* Show bonus if timed challenge */}
                        {isTimedChallenge && bonusPoints > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/30">
                                <div className="text-white text-sm">
                                    <span className="opacity-80">Base: {basePoints} pts</span>
                                    {' + '}
                                    <span className="font-bold">Bonus: +{bonusPoints} pts! 🎁</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Total Points */}
                    <div className="text-gray-600 mb-6">
                        <p className="text-sm">Your Total Points</p>
                        <p className="text-3xl font-bold text-blue-600">{totalPoints}</p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onComplete}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-lg"
                    >
                        Awesome! 🎉
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes scaleIn {
                    from {
                        transform: scale(0.5);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
}
