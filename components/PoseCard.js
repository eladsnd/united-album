"use strict";
import Image from 'next/image';

export default function PoseCard({ challenge, compact = false }) {
  if (!challenge) return null;

  return (
    <div className={`pose-card ${compact ? 'compact' : ''}`}>
      <div className="pose-image-container">
        <Image
          src={challenge.image}
          alt={challenge.title}
          width={compact ? 200 : 400}
          height={compact ? 200 : 400}
          style={{ objectFit: 'cover', borderRadius: '12px' }}
          priority={!compact}
        />
      </div>
      <div className="instruction-box">
        <h3 style={{ fontSize: compact ? '1rem' : '1.3rem', margin: 0 }}>{challenge.title}</h3>
        {!compact && <p>"{challenge.instruction}"</p>}
      </div>
    </div>
  );
}
