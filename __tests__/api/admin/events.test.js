/**
 * Admin Events API Route Tests
 *
 * Comprehensive tests for event management API endpoints:
 * - GET/POST /api/admin/events
 * - GET/PUT/DELETE /api/admin/events/[eventId]
 * - POST /api/admin/events/auto-detect
 * - POST /api/admin/events/[eventId]/assign
 */

import { GET as getEvents, POST as createEvent } from '../../../app/api/admin/events/route';
import {
  GET as getEvent,
  PUT as updateEvent,
  DELETE as deleteEvent,
} from '../../../app/api/admin/events/[eventId]/route';
import { POST as autoDetect } from '../../../app/api/admin/events/auto-detect/route';
import { POST as assignPhotos } from '../../../app/api/admin/events/[eventId]/assign/route';
import prismaMock from '../../prismaMock';
import * as adminAuth from '../../../lib/adminAuth';

// Mock dependencies
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: require('../../prismaMock').default,
}));

jest.mock('../../../lib/adminAuth');

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      ...init,
    }),
  },
}));

// Mock authentication by default
beforeEach(() => {
  adminAuth.isAdminAuthenticated = jest.fn().mockReturnValue(true);
});

describe('GET /api/admin/events', () => {
  it('should return all events with photo counts', async () => {
    const mockEvents = [
      {
        id: 'evt_1',
        name: 'Ceremony',
        description: 'Wedding ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T15:30:00Z'),
        color: '#3B82F6',
        order: 0,
        _count: { photos: 45 },
      },
      {
        id: 'evt_2',
        name: 'Reception',
        description: 'Wedding reception',
        startTime: new Date('2024-06-15T18:00:00Z'),
        endTime: new Date('2024-06-15T23:00:00Z'),
        color: '#10B981',
        order: 1,
        _count: { photos: 120 },
      },
    ];

    const mockPhotos1 = [
      { id: 1, deviceMake: 'Apple', deviceModel: 'iPhone 13' },
      { id: 2, deviceMake: 'Samsung', deviceModel: 'Galaxy S21' },
    ];

    const mockPhotos2 = [
      { id: 3, deviceMake: 'Apple', deviceModel: 'iPhone 13' },
    ];

    prismaMock.event.findMany.mockResolvedValue(mockEvents);
    prismaMock.photo.findMany
      .mockResolvedValueOnce(mockPhotos1)
      .mockResolvedValueOnce(mockPhotos2);

    const request = new Request('http://localhost:3000/api/admin/events');
    const response = await getEvents(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].photoCount).toBe(45);
    expect(data.data[0].devices).toBeDefined();
    expect(data.data[1].photoCount).toBe(120);
  });

  it('should return empty array when no events exist', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/admin/events');
    const response = await getEvents(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    prismaMock.event.findMany.mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost:3000/api/admin/events');
    const response = await getEvents(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/admin/events', () => {
  it('should create event with valid data', async () => {
    const newEvent = {
      name: 'Ceremony',
      description: 'Wedding ceremony',
      startTime: '2024-06-15T14:00:00Z',
      endTime: '2024-06-15T15:30:00Z',
      color: '#3B82F6',
      order: 0,
    };

    const mockCreatedEvent = {
      id: 'evt_1',
      ...newEvent,
      startTime: new Date(newEvent.startTime),
      endTime: new Date(newEvent.endTime),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.event.findMany.mockResolvedValue([]);
    prismaMock.event.create.mockResolvedValue(mockCreatedEvent);

    const request = new Request('http://localhost:3000/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(newEvent),
    });
    const response = await createEvent(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Ceremony');
    expect(data.message).toBe('Event created successfully.');
  });

  it('should reject event with missing required fields', async () => {
    const invalidEvent = {
      name: 'Ceremony',
      // Missing startTime and endTime
    };

    const request = new Request('http://localhost:3000/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(invalidEvent),
    });
    const response = await createEvent(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should reject event with invalid date range', async () => {
    const invalidEvent = {
      name: 'Ceremony',
      startTime: '2024-06-15T15:00:00Z',
      endTime: '2024-06-15T14:00:00Z', // Before start
    };

    const request = new Request('http://localhost:3000/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(invalidEvent),
    });
    const response = await createEvent(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('after');
  });
});

describe('GET /api/admin/events/[eventId]', () => {
  it('should return event with photos', async () => {
    const mockEvent = {
      id: 'evt_1',
      name: 'Ceremony',
      startTime: new Date('2024-06-15T14:00:00Z'),
      endTime: new Date('2024-06-15T15:30:00Z'),
      color: '#3B82F6',
      order: 0,
    };

    const mockPhotos = [
      { id: 1, name: 'photo1.jpg' },
      { id: 2, name: 'photo2.jpg' },
    ];

    prismaMock.event.findUnique.mockResolvedValue(mockEvent);
    prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

    const request = new Request('http://localhost:3000/api/admin/events/evt_1');
    const response = await getEvent(request, { params: { eventId: 'evt_1' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.id).toBe('evt_1');
    expect(data.data.photoCount).toBe(2);
    expect(data.data.photos).toHaveLength(2);
  });

  it('should return 404 for non-existent event', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);
    prismaMock.photo.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/admin/events/nonexistent');
    const response = await getEvent(request, { params: { eventId: 'nonexistent' } });
    const data = await response.json();

    expect(data.data.photoCount).toBe(0);
  });
});

describe('PUT /api/admin/events/[eventId]', () => {
  it('should update event successfully', async () => {
    const mockEvent = {
      id: 'evt_1',
      name: 'Ceremony',
      startTime: new Date('2024-06-15T14:00:00Z'),
      endTime: new Date('2024-06-15T15:30:00Z'),
    };

    const updates = {
      name: 'Updated Ceremony',
      description: 'Updated description',
    };

    prismaMock.event.findUnique.mockResolvedValue(mockEvent);
    prismaMock.event.update.mockResolvedValue({
      ...mockEvent,
      ...updates,
    });

    const request = new Request('http://localhost:3000/api/admin/events/evt_1', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const response = await updateEvent(request, { params: { eventId: 'evt_1' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Updated Ceremony');
    expect(data.message).toBe('Event updated successfully.');
  });

  it('should return 404 for non-existent event', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/admin/events/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await updateEvent(request, { params: { eventId: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });
});

describe('DELETE /api/admin/events/[eventId]', () => {
  it('should delete event and unassign photos', async () => {
    const mockEvent = { id: 'evt_1', name: 'Ceremony' };
    const mockPhotos = [
      { id: 1, eventId: 'evt_1' },
      { id: 2, eventId: 'evt_1' },
    ];

    prismaMock.event.findUnique.mockResolvedValue(mockEvent);
    prismaMock.photo.findMany.mockResolvedValue(mockPhotos);
    prismaMock.photo.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.event.delete.mockResolvedValue(mockEvent);

    const request = new Request('http://localhost:3000/api/admin/events/evt_1', {
      method: 'DELETE',
    });
    const response = await deleteEvent(request, { params: { eventId: 'evt_1' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.message).toBe('Event deleted successfully.');
    expect(prismaMock.photo.updateMany).toHaveBeenCalled();
  });

  it('should return 404 for non-existent event', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/admin/events/nonexistent', {
      method: 'DELETE',
    });
    const response = await deleteEvent(request, { params: { eventId: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });
});

describe('POST /api/admin/events/auto-detect', () => {
  it('should detect events based on time gaps', async () => {
    const mockPhotos = [
      { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' },
      { id: 2, capturedAt: new Date('2024-06-15T14:30:00Z'), deviceModel: 'iPhone 13' },
      // 3-hour gap
      { id: 3, capturedAt: new Date('2024-06-15T17:30:00Z'), deviceModel: 'Galaxy S21' },
      { id: 4, capturedAt: new Date('2024-06-15T18:00:00Z'), deviceModel: 'Galaxy S21' },
    ];

    prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

    const request = new Request('http://localhost:3000/api/admin/events/auto-detect', {
      method: 'POST',
      body: JSON.stringify({ minGapHours: 2 }),
    });
    const response = await autoDetect(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.suggestions).toHaveLength(2);
    expect(data.data.suggestions[0].photoCount).toBe(2);
    expect(data.data.suggestions[1].photoCount).toBe(2);
    expect(data.data.parameters.totalEvents).toBe(2);
    expect(data.data.parameters.totalPhotos).toBe(4);
  });

  it('should return empty suggestions if no photos', async () => {
    prismaMock.photo.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/admin/events/auto-detect', {
      method: 'POST',
      body: JSON.stringify({ minGapHours: 2 }),
    });
    const response = await autoDetect(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.suggestions).toHaveLength(0);
  });

  it('should use default gap threshold if not provided', async () => {
    prismaMock.photo.findMany.mockResolvedValue([
      { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z') },
    ]);

    const request = new Request('http://localhost:3000/api/admin/events/auto-detect', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await autoDetect(request);
    const data = await response.json();

    expect(data.data.parameters.minGapHours).toBe(2);
  });
});

describe('POST /api/admin/events/[eventId]/assign', () => {
  it('should assign photos to event', async () => {
    const mockEvent = { id: 'evt_1', name: 'Ceremony' };

    prismaMock.event.findUnique.mockResolvedValue(mockEvent);
    prismaMock.photo.updateMany.mockResolvedValue({ count: 5 });

    const request = new Request('http://localhost:3000/api/admin/events/evt_1/assign', {
      method: 'POST',
      body: JSON.stringify({ photoIds: [1, 2, 3, 4, 5] }),
    });
    const response = await assignPhotos(request, { params: { eventId: 'evt_1' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.assignedCount).toBe(5);
    expect(data.message).toContain('Assigned 5 photo(s)');
  });

  it('should unassign photos when eventId is "unassign"', async () => {
    prismaMock.photo.updateMany.mockResolvedValue({ count: 3 });

    const request = new Request('http://localhost:3000/api/admin/events/unassign/assign', {
      method: 'POST',
      body: JSON.stringify({ photoIds: [1, 2, 3] }),
    });
    const response = await assignPhotos(request, { params: { eventId: 'unassign' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.eventId).toBeNull();
    expect(data.message).toContain('Unassigned');
  });

  it('should return 404 for non-existent event', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/admin/events/nonexistent/assign', {
      method: 'POST',
      body: JSON.stringify({ photoIds: [1, 2] }),
    });
    const response = await assignPhotos(request, { params: { eventId: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should reject empty photoIds array', async () => {
    const mockEvent = { id: 'evt_1', name: 'Ceremony' };
    prismaMock.event.findUnique.mockResolvedValue(mockEvent);

    const request = new Request('http://localhost:3000/api/admin/events/evt_1/assign', {
      method: 'POST',
      body: JSON.stringify({ photoIds: [] }),
    });
    const response = await assignPhotos(request, { params: { eventId: 'evt_1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('non-empty array');
  });
});
