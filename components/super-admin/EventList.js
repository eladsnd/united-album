/**
 * Event List Component (Super Admin)
 *
 * Displays all events with stats and management actions.
 * Allows creating new events and editing existing ones.
 */

'use client';

import { useState, useEffect } from 'react';
import EventForm from './EventForm';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [includeArchived]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const url = `/api/super-admin/events${includeArchived ? '?includeArchived=true' : ''}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setEvents(data.events || []);
      setError(null);
    } catch (err) {
      console.error('[EventList] Error loading events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingEvent(null);
    setShowForm(true);
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEvent(null);
    loadEvents(); // Refresh list
  };

  const handleArchive = async (eventId, eventName) => {
    if (!confirm(`Archive event "${eventName}"? This will deactivate the event.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      const res = await fetch(`/api/super-admin/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      alert(`Event "${eventName}" archived successfully`);
      loadEvents();
    } catch (err) {
      console.error('[EventList] Error archiving event:', err);
      alert('Failed to archive event');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadEvents}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Events ({events.length})
          </h2>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="mr-2 rounded"
            />
            Include archived
          </label>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Create Event
        </button>
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <EventForm
          event={editingEvent}
          onClose={handleFormClose}
        />
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No events found</p>
          <button
            onClick={handleCreateNew}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Your First Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Event Color Bar */}
              <div
                className="h-2 rounded-t-lg"
                style={{ backgroundColor: event.color }}
              ></div>

              {/* Event Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {event.name}
                    </h3>
                    <p className="text-sm text-gray-500">{event.slug}</p>
                  </div>
                  {event.isArchived && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      Archived
                    </span>
                  )}
                  {!event.isActive && !event.isArchived && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                      Inactive
                    </span>
                  )}
                </div>

                {event.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <span className="font-medium w-20">Type:</span>
                    <span className="capitalize">{event.eventType}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">Date:</span>
                    <span>{new Date(event.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">Photos:</span>
                    <span>{event.photoCount}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">Admins:</span>
                    <span>{event.adminCount}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(event)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
                  >
                    Edit
                  </button>
                  {!event.isArchived && (
                    <button
                      onClick={() => handleArchive(event.id, event.name)}
                      className="flex-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
