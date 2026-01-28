"use client";
import { useState } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { useAdminData } from '@/lib/hooks/useAdminData';
import { useAdminForm } from '@/lib/hooks/useAdminForm';
import { useSuccessMessage } from '@/lib/hooks/useSuccessMessage';
import AdminFormModal from '@/components/admin/AdminFormModal';
import AdminGrid from '@/components/admin/AdminGrid';

export default function AdminEventManager({ adminToken }) {
  // Data fetching with defensive checks built-in
  const { data: events, loading, refetch } = useAdminData('/api/admin/events');
  const [successMessage, setSuccess] = useSuccessMessage();

  // Auto-detect state
  const [autoDetectLoading, setAutoDetectLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [gapThreshold, setGapThreshold] = useState(2);

  // Form management with all state/handlers extracted
  const form = useAdminForm(
    { name: '', description: '', startTime: '', endTime: '', color: '#3B82F6', order: 0 },
    async (data, editing) => {
      const res = await fetch(
        editing ? `/api/admin/events/${editing.id}` : '/api/admin/events',
        {
          method: editing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify(data),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save event');
    },
    () => {
      setSuccess('Event saved successfully!');
      refetch();
    }
  );

  const handleAutoDetect = async () => {
    setAutoDetectLoading(true);
    form.setFormData({ ...form.formData }); // Clear any form errors

    try {
      const res = await fetch('/api/admin/events/auto-detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ minGapHours: gapThreshold }),
      });
      const data = await res.json();

      if (data.success) {
        setSuggestions(Array.isArray(data.data?.suggestions) ? data.data.suggestions : []);
        setSuccess(data.message || 'Auto-detect complete!');
      } else {
        throw new Error(data.error || 'Auto-detect failed');
      }
    } catch (err) {
      setSuccess(''); // Clear any existing success
      alert(err.message || 'Failed to auto-detect events');
    } finally {
      setAutoDetectLoading(false);
    }
  };

  const handleCreateSuggested = async (suggestion) => {
    try {
      // Create event
      const eventRes = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: suggestion.name,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime,
          color: suggestion.suggestedColor,
          order: events?.length || 0,
        }),
      });
      const eventData = await eventRes.json();

      if (eventData.success) {
        // Assign photos to the new event
        await fetch(`/api/admin/events/${eventData.data.id}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ photoIds: suggestion.photoIds || [] }),
        });

        setSuccess(`Event "${suggestion.name}" created with ${suggestion.photoCount || 0} photos`);
        setSuggestions(suggestions?.filter(s => s !== suggestion) ?? []);
        refetch();
      } else {
        throw new Error(eventData.error || 'Failed to create event');
      }
    } catch (err) {
      alert(err.message || 'Failed to create event from suggestion');
    }
  };

  const handleDelete = async (event) => {
    if (!confirm(`Delete "${event.name}"? Photos will be unassigned.`)) return;

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Event deleted successfully!');
        refetch();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete event');
    }
  };

  const transformEventToForm = (event) => ({
    name: event.name,
    description: event.description || '',
    startTime: new Date(event.startTime).toISOString().slice(0, 16),
    endTime: new Date(event.endTime).toISOString().slice(0, 16),
    color: event.color,
    order: event.order,
  });

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start, end) => {
    const duration = new Date(end) - new Date(start);
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Event Timeline Manager</h2>
          <p className="text-sm text-gray-500 mt-1">Organize photos into events and detect timeline boundaries</p>
        </div>
        <button className="btn" onClick={form.openAddForm}>
          + Create Event
        </button>
      </div>

      {successMessage && <div className="success-banner mb-6">{successMessage}</div>}

      {/* Auto-Detect Section */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(59, 130, 246, 0.05))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Sparkles className="text-purple-600" size={24} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Auto-Detect Events</h2>
        </div>
        <p style={{ marginBottom: '1rem', opacity: 0.7 }}>
          Analyze photo timeline and automatically suggest event boundaries based on time gaps.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Minimum Gap:</label>
            <select
              value={gapThreshold}
              onChange={(e) => setGapThreshold(Number(e.target.value))}
              className="form-input"
              style={{ width: 'auto' }}
            >
              <option value={0.5}>30 minutes</option>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={3}>3 hours</option>
              <option value={4}>4 hours</option>
            </select>
          </div>
          <button
            onClick={handleAutoDetect}
            disabled={autoDetectLoading}
            className="btn"
            style={{ background: '#8b5cf6' }}
          >
            {autoDetectLoading ? (
              <>
                <span className="animate-spin">⟳</span>
                Analyzing...
              </>
            ) : (
              'Auto-Detect Events'
            )}
          </button>
        </div>

        {/* Suggestions */}
        {suggestions?.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Suggested Events ({suggestions.length})</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: suggestion.suggestedColor }}
                        />
                        <h4 className="font-semibold text-gray-900">{suggestion.name}</h4>
                        <span className="text-sm text-gray-500">{suggestion.photoCount} photos</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <Calendar size={14} className="inline mr-1" />
                          {formatDateTime(suggestion.startTime)} → {formatDateTime(suggestion.endTime)}
                        </p>
                        {suggestion.devices?.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Devices: {suggestion.devices.map(d => `${d.model} (${d.count})`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCreateSuggested(suggestion)}
                      className="btn"
                      style={{ background: '#10b981', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                      Create & Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Events List */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Events ({events?.length ?? 0})
        </h2>
        <AdminGrid
          items={events}
          loading={loading}
          emptyMessage="No events yet. Create one or use auto-detect!"
          emptyIcon="📅"
        >
          {(event) => (
            <div
              key={event.id}
              className="pose-card-admin card"
              style={{ borderLeft: `4px solid ${event.color}` }}
            >
              <div className="pose-card-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div
                    style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', backgroundColor: event.color }}
                  />
                  <h3 style={{ fontWeight: '600', margin: 0, flex: 1 }}>{event.name}</h3>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                  }}>
                    {event.photoCount || 0} photos
                  </span>
                </div>
                {event.description && (
                  <p className="pose-instruction-preview">{event.description}</p>
                )}
                <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1rem' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} />
                    {formatDateTime(event.startTime)} → {formatDateTime(event.endTime)}
                    <span style={{ opacity: 0.7 }}>({formatDuration(event.startTime, event.endTime)})</span>
                  </p>
                  {event.devices?.length > 0 && (
                    <p style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                      Devices: {event.devices.map(d => `${d.model} (${d.count})`).join(', ')}
                    </p>
                  )}
                </div>
                <div className="pose-card-actions">
                  <button
                    className="btn-edit"
                    onClick={() => form.openEditForm(event, transformEventToForm)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(event)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </AdminGrid>
      </div>

      {/* Event Form Modal */}
      <AdminFormModal
        isOpen={form.showForm}
        onClose={form.closeForm}
        title={form.editingItem ? 'Edit Event' : 'Add New Event'}
        error={form.formError}
        onSubmit={form.handleSubmit}
        submitLabel={form.editingItem ? '✓ Update Event' : '+ Create Event'}
        loading={form.formLoading}
      >
        <div className="form-group">
          <label className="form-label">Event Name *</label>
          <input
            type="text"
            value={form.formData.name}
            onChange={(e) => form.setFormData({ ...form.formData, name: e.target.value })}
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            value={form.formData.description}
            onChange={(e) => form.setFormData({ ...form.formData, description: e.target.value })}
            className="form-textarea"
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Time *</label>
            <input
              type="datetime-local"
              value={form.formData.startTime}
              onChange={(e) => form.setFormData({ ...form.formData, startTime: e.target.value })}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Time *</label>
            <input
              type="datetime-local"
              value={form.formData.endTime}
              onChange={(e) => form.setFormData({ ...form.formData, endTime: e.target.value })}
              className="form-input"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="color"
              value={form.formData.color}
              onChange={(e) => form.setFormData({ ...form.formData, color: e.target.value })}
              style={{ height: '2.5rem', width: '5rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.875rem', opacity: 0.6 }}>{form.formData.color}</span>
          </div>
        </div>
      </AdminFormModal>
    </div>
  );
}
