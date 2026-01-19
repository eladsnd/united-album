"use strict";
import Image from 'next/image';

export default function PoseCard({ challenge, compact = false, onClick }) {
  if (!challenge) return null;

  // Detect if text contains Hebrew characters
  const isHebrew = (text) => /[\u0590-\u05FF]/.test(text);
  const instructionIsRTL = isHebrew(challenge.instruction);
  const titleIsRTL = isHebrew(challenge.title);

  return (
    <div
      className={`pose-card ${compact ? 'compact' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="pose-image-container">
        <Image
          src={challenge.image}
          alt={challenge.title}
          width={compact ? 200 : 400}
          height={compact ? 200 : 400}
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '12px'
          }}
          priority={!compact}
        />
      </div>
      <div className="instruction-box" style={{ direction: instructionIsRTL ? 'rtl' : 'ltr' }}>
        <h3 style={{
          fontSize: compact ? '1rem' : '1.3rem',
          margin: 0,
          direction: titleIsRTL ? 'rtl' : 'ltr'
        }}>
          {challenge.title}
        </h3>
        {!compact && <p style={{ direction: instructionIsRTL ? 'rtl' : 'ltr' }}>"{challenge.instruction}"</p>}
      </div>
    </div>
  );
}
