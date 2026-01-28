/**
 * Feature Flag Management Panel (Admin)
 *
 * Provides UI for enabling/disabling all application features.
 * Shows feature descriptions and current status.
 */

"use client";
import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Sparkles, Calendar, ScanFace, Heart, Upload, Camera } from 'lucide-react';

export default function FeatureFlagPanel({ adminToken }) {
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const features = [
    {
      id: 'challenges',
      label: 'Pose Challenges',
      description: 'Interactive pose challenges for guests to complete',
      icon: Camera,
      color: '#06b6d4',
      gradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
    },
    {
      id: 'gamification',
      label: 'Gamification',
      description: 'Points system, leaderboard, and timed challenges',
      icon: Sparkles,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    },
    {
      id: 'events',
      label: 'Event Timeline',
      description: 'Event management and photo timeline organization',
      icon: Calendar,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    },
    {
      id: 'faceDetection',
      label: 'Face Detection',
      description: 'Automatic face recognition and photo filtering',
      icon: ScanFace,
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
    },
    {
      id: 'photoLikes',
      label: 'Photo Likes',
      description: 'Allow guests to like/unlike photos',
      icon: Heart,
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    },
    {
      id: 'bulkUpload',
      label: 'Bulk Upload',
      description: 'Upload regular photos without pose challenges',
      icon: Upload,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
    },
  ];

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      if (data.success) {
        setFlags(data.data);
      }
    } catch (err) {
      console.error('Error fetching feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureId) => {
    setSaving(featureId);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          [featureId]: !flags[featureId],
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFlags(data.data);
      }
    } catch (err) {
      console.error('Error toggling feature:', err);
    } finally {
      setSaving(null);
    }
  };

  // Removed loading spinner - use skeleton cards instead to prevent layout shift

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Feature Flags</h2>
        <p className="text-sm text-gray-500 mt-1">Enable or disable features across the entire application</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#4f46e5' }}>
          Application Features
        </h3>
        <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>
          Enable or disable features across the entire application. Changes take effect immediately.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {features?.map((feature) => {
          const Icon = feature?.icon;
          const enabled = flags?.[feature?.id] ?? false;
          const isSaving = saving === feature?.id;
          const isDisabled = loading || isSaving;

          return (
            <div
              key={feature.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.25rem',
                transition: 'all 0.3s ease',
                border: enabled ? `2px solid ${feature.color}20` : '2px solid transparent',
                background: enabled ? `${feature.color}08` : 'var(--glass)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {/* Mobile: Stack vertically */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}>
                {/* Icon - smaller on mobile */}
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    background: feature.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${feature.color}30`,
                  }}
                >
                  <Icon size={24} color="white" strokeWidth={2.5} />
                </div>

                {/* Feature Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    marginBottom: '0.25rem',
                    color: enabled ? feature.color : 'inherit',
                    transition: 'color 0.3s ease'
                  }}>
                    {feature.label}
                  </h3>
                  <p style={{
                    fontSize: '0.8125rem',
                    opacity: 0.7,
                    margin: 0,
                    lineHeight: '1.4'
                  }}>
                    {feature.description}
                  </p>
                </div>
              </div>

              {/* Toggle Button - full width on mobile */}
              <button
                onClick={() => toggleFeature(feature.id)}
                disabled={isDisabled}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: '700',
                  borderRadius: '0.75rem',
                  background: enabled
                    ? feature.gradient
                    : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                  color: enabled ? 'white' : '#6b7280',
                  border: 'none',
                  boxShadow: enabled
                    ? `0 6px 16px ${feature.color}40, 0 2px 4px ${feature.color}30`
                    : '0 2px 8px rgba(0,0,0,0.08)',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.7 : 1,
                  transition: 'all 0.3s ease',
                  transform: isDisabled ? 'scale(0.98)' : 'scale(1)',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = enabled
                      ? `0 8px 20px ${feature.color}50, 0 4px 8px ${feature.color}40`
                      : '0 4px 12px rgba(0,0,0,0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = enabled
                      ? `0 6px 16px ${feature.color}40, 0 2px 4px ${feature.color}30`
                      : '0 2px 8px rgba(0,0,0,0.08)';
                  }
                }}
              >
                {isSaving ? (
                  <>
                    <div
                      className="animate-spin rounded-full border-2 border-white border-t-transparent"
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span>Updating...</span>
                  </>
                ) : enabled ? (
                  <>
                    <ToggleRight size={24} strokeWidth={2.5} />
                    <span>ON</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={24} strokeWidth={2.5} />
                    <span>OFF</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="card" style={{ marginTop: '2rem', padding: '1.25rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(16, 185, 129, 0.05))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '1.5rem' }}>💡</div>
          <div>
            <p style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Pro Tip
            </p>
            <p style={{ fontSize: '0.8125rem', opacity: 0.7, margin: 0 }}>
              Feature changes are instant. You can toggle features on/off at any time during your event.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
