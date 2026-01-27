"use client";

/**
 * Admin Grid Component
 *
 * Responsive grid with built-in loading and empty states.
 * Eliminates 30 lines of duplicate code per component.
 *
 * @param {Array} items - Items to render (default: [])
 * @param {boolean} loading - Loading state
 * @param {string} emptyMessage - Message when no items
 * @param {string} emptyIcon - Icon when no items
 * @param {function} children - Render function: (item, index) => ReactNode
 */
export default function AdminGrid({
  items = [],
  loading = false,
  emptyMessage = "No items yet. Create one to get started!",
  emptyIcon = "📦",
  children
}) {
  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', background: 'var(--accent)', border: '2px dashed var(--glass-border)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{emptyIcon}</div>
        <p style={{ opacity: 0.6 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="pose-manager-grid">
      {items.map((item, index) => children(item, index))}
    </div>
  );
}
