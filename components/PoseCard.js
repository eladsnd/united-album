"use strict";
import Image from 'next/image';

export default function PoseCard({ challenge }) {
    if (!challenge) return null;

    return (
        <div className="pose-card">
            <div className="pose-image-container">
                <Image
                    src={challenge.image}
                    alt={challenge.title}
                    width={400}
                    height={400}
                    style={{ objectFit: 'cover', borderRadius: '12px' }}
                />
            </div>
            <div className="instruction-box">
                <h3>{challenge.title}</h3>
                <p>"{challenge.instruction}"</p>
            </div>
            <style jsx>{`
        .pose-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .pose-image-container {
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1/1;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          border-radius: 12px;
        }
      `}</style>
        </div>
    );
}
