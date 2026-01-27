"use client";

import { useState } from 'react';
import { Calendar, Clock, Camera, Users, Zap, Sparkles } from 'lucide-react';

/**
 * Event Timeline Visualization Component
 *
 * Displays auto-detected events in a visual timeline with:
 * - Chronological event flow
 * - Color-coded event types
 * - Photo counts and duration
 * - Device breakdown
 * - Confidence scores
 */
export default function EventTimelineVisual({ events = [], onCreateEvent, onSplitEvent, onMergeEvents }) {
  const [selectedEvents, setSelectedEvents] = useState([]);

  if (!events || events.length === 0) {
    return (
      <div className="timeline-empty card" style={{ textAlign: 'center', padding: '3rem', background: 'var(--accent)' }}>
        <Calendar size={48} style={{ opacity: 0.4, margin: '0 auto 1rem' }} />
        <p style={{ opacity: 0.6, marginBottom: '1rem' }}>No events detected yet</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.4 }}>
          Upload photos with timestamps to enable auto-detection
        </p>
      </div>
    );
  }

  const toggleEventSelection = (index) => {
    if (selectedEvents.includes(index)) {
      setSelectedEvents(selectedEvents.filter(i => i !== index));
    } else {
      setSelectedEvents([...selectedEvents, index]);
    }
  };

  const handleMergeSelected = () => {
    if (selectedEvents.length < 2) {
      alert('Please select at least 2 events to merge');
      return;
    }

    const eventsToMerge = selectedEvents
      .sort((a, b) => a - b)
      .map(i => events[i]);

    onMergeEvents?.(eventsToMerge);
    setSelectedEvents([]);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return hours + 'h ' + mins + 'm';
    }
    return mins + 'm';
  };

  const getColorRGB = (hexColor) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return r + ', ' + g + ', ' + b;
  };

  const calculateGap = (endTime, startTime) => {
    const gap = (new Date(startTime) - new Date(endTime)) / (1000 * 60); // minutes
    const hours = Math.floor(gap / 60);
    const mins = Math.round(gap % 60);

    if (hours > 0) {
      return hours + 'h ' + mins + 'm';
    }
    return mins + 'm';
  };

  return (
    <div className="event-timeline-visual">
      {selectedEvents.length > 0 && (
        <div className="timeline-actions card" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ opacity: 0.8 }}>
              {selectedEvents.length} event(s) selected
            </span>
            {selectedEvents.length >= 2 && (
              <button className="btn" onClick={handleMergeSelected}>
                Merge Selected
              </button>
            )}
          </div>
        </div>
      )}

      <div className="timeline-container">
        {events.map((event, index) => {
          const isSelected = selectedEvents.includes(index);
          const isLastEvent = index === events.length - 1;
          const selectedClass = isSelected ? 'selected' : '';

          return (
            <div key={index} className="timeline-event-wrapper">
              <div
                className={'timeline-event-card card ' + selectedClass}
                onClick={() => toggleEventSelection(index)}
                style={{
                  borderLeft: '4px solid ' + event.suggestedColor,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isSelected ? 'var(--accent)' : 'var(--background-elevated)',
                }}
              >
                <div className="event-header" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontWeight: '500', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {event.name}
                        {event.eventType === 'ceremony' && <Sparkles size={16} />}
                        {event.eventType === 'party' && <Zap size={16} />}
                      </h3>
                      <div style={{ fontSize: '0.85rem', opacity: 0.6, textTransform: 'capitalize' }}>
                        {event.eventType}
                      </div>
                    </div>
                    <div className="confidence-badge" style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      background: 'rgba(' + getColorRGB(event.suggestedColor) + ', 0.2)',
                      color: event.suggestedColor,
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {Math.round(event.confidence * 100)}% match
                    </div>
                  </div>
                </div>

                <div className="event-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="stat">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', opacity: 0.6 }}>
                      <Clock size={14} />
                      <span style={{ fontSize: '0.85rem' }}>Time</span>
                    </div>
                    <div style={{ fontWeight: '500' }}>
                      {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>
                      {formatDuration(event.duration)}
                    </div>
                  </div>

                  <div className="stat">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', opacity: 0.6 }}>
                      <Camera size={14} />
                      <span style={{ fontSize: '0.85rem' }}>Photos</span>
                    </div>
                    <div style={{ fontWeight: '500', fontSize: '1.5rem' }}>
                      {event.photoCount}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>
                      {Math.round(event.photoDensity)} per hour
                    </div>
                  </div>

                  {event.devices && event.devices.length > 0 && (
                    <div className="stat">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', opacity: 0.6 }}>
                        <Users size={14} />
                        <span style={{ fontSize: '0.85rem' }}>Devices</span>
                      </div>
                      <div style={{ fontWeight: '500' }}>
                        {event.devices.length} device{event.devices.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>
                        {event.devices[0]?.model || 'Unknown'}
                        {event.devices.length > 1 && ' +' + (event.devices.length - 1)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="event-actions" style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEvent?.(event);
                    }}
                    style={{ flex: 1 }}
                  >
                    Create Event
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSplitEvent?.(event);
                    }}
                  >
                    Split
                  </button>
                </div>
              </div>

              {!isLastEvent && (
                <div className="timeline-connector" style={{ textAlign: 'center', padding: '1rem 0', opacity: 0.4 }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    {calculateGap(events[index].endTime, events[index + 1].startTime)} gap
                  </div>
                  <div style={{ height: '2rem', width: '2px', background: 'var(--glass-border)', margin: '0.5rem auto' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .event-timeline-visual {
          max-width: 800px;
          margin: 0 auto;
        }

        .timeline-event-card.selected {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          transform: translateY(-2px);
        }

        .timeline-event-card:hover {
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
}
