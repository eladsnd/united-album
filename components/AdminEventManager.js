"use client";
import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Edit2, Trash2, Sparkles, CheckCircle, XCircle } from 'lucide-react';

export default function AdminEventManager({ adminToken }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    color: '#3B82F6',
    order: 0,
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [autoDetectLoading, setAutoDetectLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [gapThreshold, setGapThreshold] = useState(2);
  const [showAssignView, setShowAssignView] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [unassignedPhotos, setUnassignedPhotos] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.data);
      }
    } catch (err) {
      console.error('[AdminEventManager] Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDetect = async () => {
    setAutoDetectLoading(true);
    setFormError('');
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
        setSuggestions(data.data.suggestions);
        setSuccessMessage(data.message);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setFormError(data.error || 'Auto-detect failed');
      }
    } catch (err) {
      setFormError('Failed to auto-detect events');
      console.error('[AdminEventManager] Auto-detect error:', err);
    } finally {
      setAutoDetectLoading(false);
    }
  };

  const handleCreateSuggested = async (suggestion) => {
    setFormLoading(true);
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
          order: events.length,
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
          body: JSON.stringify({ photoIds: suggestion.photoIds }),
        });

        setSuccessMessage(`Event "${suggestion.name}" created with ${suggestion.photoCount} photos`);
        setTimeout(() => setSuccessMessage(''), 5000);

        // Remove from suggestions and refresh events
        setSuggestions(suggestions.filter(s => s !== suggestion));
        fetchEvents();
      } else {
        setFormError(eventData.error || 'Failed to create event');
      }
    } catch (err) {
      setFormError('Failed to create event from suggestion');
      console.error('[AdminEventManager] Error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const url = editingEvent
        ? `/api/admin/events/${editingEvent.id}`
        : '/api/admin/events';
      const method = editingEvent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(data.message);
        setTimeout(() => setSuccessMessage(''), 5000);
        fetchEvents();
        closeForm();
      } else {
        setFormError(data.error || 'Operation failed');
      }
    } catch (err) {
      setFormError('Failed to save event');
      console.error('[AdminEventManager] Submit error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure? Photos will be unassigned from this event.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message);
        setTimeout(() => setSuccessMessage(''), 5000);
        fetchEvents();
      } else {
        setFormError(data.error || 'Delete failed');
      }
    } catch (err) {
      setFormError('Failed to delete event');
      console.error('[AdminEventManager] Delete error:', err);
    }
  };

  const openAddForm = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      description: '',
      startTime: '',
      endTime: '',
      color: '#3B82F6',
      order: events.length,
    });
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || '',
      startTime: new Date(event.startTime).toISOString().slice(0, 16),
      endTime: new Date(event.endTime).toISOString().slice(0, 16),
      color: event.color,
      order: event.order,
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setFormData({
      name: '',
      description: '',
      startTime: '',
      endTime: '',
      color: '#3B82F6',
      order: 0,
    });
    setFormError('');
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
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
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Timeline Manager</h1>
          <p className="text-gray-600 mt-2">Organize photos into events based on time and device</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Create Event
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-800">
          <CheckCircle size={20} />
          {successMessage}
        </div>
      )}

      {/* Auto-Detect Section */}
      <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="text-purple-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Auto-Detect Events</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Analyze photo timeline and automatically suggest event boundaries based on time gaps.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Minimum Gap:</label>
            <select
              value={gapThreshold}
              onChange={(e) => setGapThreshold(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {autoDetectLoading ? 'Analyzing...' : 'Auto-Detect Events'}
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Suggested Events ({suggestions.length})</h3>
            <div className="grid gap-3">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
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
                        {suggestion.devices.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Devices: {suggestion.devices.map(d => `${d.model} (${d.count})`).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCreateSuggested(suggestion)}
                      disabled={formLoading}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
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
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Events ({events.length})
        </h2>
        {events.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Calendar className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600">No events yet. Create one or use auto-detect.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-5 bg-white border-l-4 rounded-lg shadow-sm hover:shadow-md transition"
                style={{ borderLeftColor: event.color }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <h3 className="text-xl font-semibold text-gray-900">{event.name}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {event.photoCount || 0} photos
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-gray-600 mb-3">{event.description}</p>
                    )}
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="flex items-center gap-2">
                        <Calendar size={16} />
                        {formatDateTime(event.startTime)} → {formatDateTime(event.endTime)}
                        <span className="text-gray-500">({formatDuration(event.startTime, event.endTime)})</span>
                      </p>
                      {event.devices && event.devices.length > 0 && (
                        <p className="text-xs text-gray-500 ml-6">
                          Devices: {event.devices.map(d => `${d.model} (${d.count})`).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(event)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit event"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete event"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
                <XCircle size={18} />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">{formData.color}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
