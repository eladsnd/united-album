/**
 * Public Events API Route Tests
 *
 * Tests for GET /api/events (public endpoint for gallery filtering)
 */

import { GET } from '../../app/api/events/route';
import prismaMock from '../prismaMock';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: require('../prismaMock').default,
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      ...init,
    }),
  },
}));

describe('GET /api/events', () => {
  it('should return all events with photo counts (public fields only)', async () => {
    const mockEvents = [
      {
        id: 'evt_1',
        name: 'Ceremony',
        description: 'Wedding ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T15:30:00Z'),
        color: '#3B82F6',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { photos: 45 },
        photoCount: 45,
      },
      {
        id: 'evt_2',
        name: 'Reception',
        description: 'Wedding reception',
        startTime: new Date('2024-06-15T18:00:00Z'),
        endTime: new Date('2024-06-15T23:00:00Z'),
        color: '#10B981',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { photos: 120 },
        photoCount: 120,
      },
    ];

    prismaMock.event.findMany.mockResolvedValue(mockEvents);

    const request = new Request('http://localhost:3000/api/events');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);

    // Verify only public fields are returned
    const firstEvent = data.data[0];
    expect(firstEvent.id).toBe('evt_1');
    expect(firstEvent.name).toBe('Ceremony');
    expect(firstEvent.description).toBe('Wedding ceremony');
    expect(firstEvent.startTime).toBeDefined();
    expect(firstEvent.endTime).toBeDefined();
    expect(firstEvent.color).toBe('#3B82F6');
    expect(firstEvent.photoCount).toBe(45);

    // Sensitive fields should not be exposed
    expect(firstEvent.createdAt).toBeUndefined();
    expect(firstEvent.updatedAt).toBeUndefined();
    expect(firstEvent.order).toBeUndefined();
  });

  it('should return empty array when no events exist', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/events');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    prismaMock.event.findMany.mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/events');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it('should not require authentication', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/events');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Should succeed without any auth headers
  });
});
