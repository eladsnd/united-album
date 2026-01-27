"use client";

/**
 * Admin Form Modal Component
 *
 * Reusable modal for admin CRUD forms.
 * Eliminates 80 lines of duplicate code per component.
 *
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Close handler
 * @param {string} title - Modal title
 * @param {string} error - Error message to display
 * @param {React.ReactNode} children - Form fields
 * @param {function} onSubmit - Form submit handler
 * @param {string} submitLabel - Submit button text (default: "Save")
 * @param {boolean} loading - Submit loading state
 */
export default function AdminFormModal({
  isOpen,
  onClose,
  title,
  error,
  children,
  onSubmit,
  submitLabel = "Save",
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pose-form-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontWeight: '400', marginBottom: '0' }}>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={onSubmit} className="pose-form">
          {children}

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn">
              {loading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Saving...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
