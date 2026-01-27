/**
 * Feature Flag Management Panel (Admin)
 *
 * Provides UI for enabling/disabling all application features.
 * Shows feature descriptions and current status.
 */

"use client";
import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Sparkles, Calendar, ScanFace, Heart, Upload } from 'lucide-react';

export default function FeatureFlagPanel({ adminToken }) {
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const features = [
    {
      id: 'gamification',
      label: 'Gamification',
      description: 'Points system, leaderboard, and timed challenges',
      icon: Sparkles,
      color: '#f59e0b',
    },
    {
      id: 'events',
      label: 'Event Timeline',
      description: 'Event management and photo timeline organization',
      icon: Calendar,
      color: '#3b82f6',
    },
    {
      id: 'faceDetection',
      label: 'Face Detection',
      description: 'Automatic face recognition and photo filtering',
      icon: ScanFace,
      color: '#8b5cf6',
    },
    {
      id: 'photoLikes',
      label: 'Photo Likes',
      description: 'Allow guests to like/unlike photos',
      icon: Heart,
      color: '#ec4899',
    },
    {
      id: 'bulkUpload',
      label: 'Bulk Upload',
      description: 'Upload regular photos without pose challenges',
      icon: Upload,
      color: '#10b981',
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

  if (loading) {
    return <div>Loading feature flags...</div>;
  }

  return (
    <div className="feature-flag-panel">
      <div className="panel-header">
        <h2>Feature Flags</h2>
        <p>Enable or disable application features</p>
      </div>

      <div className="features-grid">
        {features.map((feature) => {
          const Icon = feature.icon;
          const enabled = flags[feature.id] || false;
          const isSaving = saving === feature.id;

          return (
            <div key={feature.id} className="feature-card">
              <div className="feature-icon" style={{ backgroundColor: feature.color }}>
                <Icon size={24} color="white" />
              </div>

              <div className="feature-info">
                <h3>{feature.label}</h3>
                <p>{feature.description}</p>
              </div>

              <button
                className={`toggle-btn ${enabled ? 'enabled' : 'disabled'}`}
                onClick={() => toggleFeature(feature.id)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span>Updating...</span>
                ) : enabled ? (
                  <>
                    <ToggleRight size={20} />
                    <span>ON</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={20} />
                    <span>OFF</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .feature-flag-panel {
          padding: 2rem;
        }
        .panel-header {
          margin-bottom: 2rem;
        }
        .panel-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .panel-header p {
          color: #6b7280;
        }
        .features-grid {
          display: grid;
          gap: 1rem;
        }
        .feature-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .feature-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .feature-info {
          flex: 1;
        }
        .feature-info h3 {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        .feature-info p {
          font-size: 0.875rem;
          color: #6b7280;
        }
        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-btn.enabled {
          background: #10b981;
          color: white;
        }
        .toggle-btn.disabled {
          background: #e5e7eb;
          color: #6b7280;
        }
        .toggle-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
