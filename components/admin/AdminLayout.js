"use client";

/**
 * Admin Layout Component
 *
 * Provides consistent header structure for all admin panels.
 * Eliminates 25 lines of duplicate code per component.
 *
 * @param {string} title - Panel title
 * @param {string} badge - Badge text (default: "Administrator")
 * @param {React.ReactNode} actions - Header action buttons
 * @param {React.ReactNode} children - Panel content
 */
export default function AdminLayout({ title, badge = "Administrator", actions, children }) {
  return (
    <div className="admin-pose-manager">
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-content">
            <h1 style={{ fontWeight: '400', marginBottom: '0.5rem' }}>
              {title}
            </h1>
            <div className="admin-badge">{badge}</div>
          </div>
        </div>
        <div className="admin-header-actions">
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
