"use client";
import { useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Heart } from 'lucide-react';

export default function ImageModal({ imageUrl, altText, onClose, downloadUrl, onNext, onPrev, hasNext, hasPrev, photoId, isLiked, likeCount, onToggleLike, photoLikesEnabled = true }) {
  // Close on ESC key, navigate with arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className="image-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        className="modal-close-btn"
        onClick={onClose}
        aria-label="Close preview"
      >
        <X size={32} />
      </button>

      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          className="modal-download-btn"
          onClick={(e) => e.stopPropagation()}
          aria-label="Download full resolution"
        >
          <Download size={24} />
          Download
        </a>
      )}

      {photoLikesEnabled && photoId && onToggleLike && (
        <button
          className={`modal-like-btn ${isLiked ? 'liked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(photoId);
          }}
          aria-label={isLiked ? 'Unlike photo' : 'Like photo'}
        >
          <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} />
          {likeCount > 0 && <span className="modal-like-count">{likeCount}</span>}
        </button>
      )}

      <div
        className="image-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <button
            className="modal-nav-btn modal-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <img
          src={imageUrl}
          alt={altText}
          style={{
            maxWidth: '85vw',
            maxHeight: '75vh',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '12px',
            display: 'block'
          }}
        />

        {hasNext && (
          <button
            className="modal-nav-btn modal-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            aria-label="Next photo"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>
    </div>
  );
}
