"use client";
import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

export default function ImageModal({ imageUrl, altText, onClose, downloadUrl }) {
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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

      <div
        className="image-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
}
