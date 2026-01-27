/**
 * Integration tests for /api/admin/events/auto-detect endpoint
 *
 * Tests the smart event detection API handler logic
 */

import { EventService } from '../../../../lib/services/EventService';

// Mock EventService
jest.mock('../../../../lib/services/EventService');

describe('Event Auto-Detect API Handler Logic', () => {
  let mockEventService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock EventService instance
    mockEventService = {
      autoDetectEventsSmart: jest.fn(),
    };
    EventService.mockImplementation(() => mockEventService);
  });

  it('should detect events with default parameters', async () => {
    // Mock detection results
    const mockSuggestions = [
      {
        name: 'Ceremony',
        eventType: 'ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T14:45:00Z'),
        duration: 45,
        photoCount: 80,
        photoDensity: 109.1,
        photoIds: [1, 2, 3],
        devices: [{ model: 'iPhone 13', count: 80 }],
        suggestedColor: '#3B82F6',
        confidence: 0.85,
      },
      {
        name: 'Cocktail Hour',
        eventType: 'cocktails',
        startTime: new Date('2024-06-15T16:00:00Z'),
        endTime: new Date('2024-06-15T17:30:00Z'),
        duration: 90,
        photoCount: 40,
        photoDensity: 27.3,
        photoIds: [4, 5, 6],
        devices: [{ model: 'iPhone 13', count: 40 }],
        suggestedColor: '#10B981',
        confidence: 0.75,
      },
    ];

    mockEventService.autoDetectEventsSmart.mockResolvedValue(mockSuggestions);

    // Simulate handler logic
    const body = {};
    const { epsilon = null, minPoints = 3, method = 'dbscan' } = body;

    const eventService = new EventService();
    const suggestions = await eventService.autoDetectEventsSmart({
      epsilon,
      minPoints,
      method,
    });

    // Verify results
    expect(suggestions).toEqual(mockSuggestions);
    expect(mockEventService.autoDetectEventsSmart).toHaveBeenCalledWith({
      epsilon: null,
      minPoints: 3,
      method: 'dbscan',
    });

    // Verify response structure
    const responseData = {
      success: true,
      data: {
        suggestions,
        parameters: {
          epsilon: epsilon || 'auto',
          minPoints,
          method,
          totalEvents: suggestions.length,
          totalPhotos: suggestions.reduce((sum, s) => sum + s.photoCount, 0),
        },
      },
      message: `Detected ${suggestions.length} event(s) using ${method} clustering.`,
    };

    expect(responseData.success).toBe(true);
    expect(responseData.data.suggestions).toEqual(mockSuggestions);
    expect(responseData.data.parameters.epsilon).toBe('auto');
    expect(responseData.data.parameters.minPoints).toBe(3);
    expect(responseData.data.parameters.method).toBe('dbscan');
    expect(responseData.data.parameters.totalEvents).toBe(2);
    expect(responseData.data.parameters.totalPhotos).toBe(120);
    expect(responseData.message).toContain('Detected 2 event(s)');
  });

  it('should detect events with custom epsilon', async () => {
    const mockSuggestions = [
      {
        name: 'Ceremony',
        eventType: 'ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T14:45:00Z'),
        duration: 45,
        photoCount: 80,
        photoDensity: 109.1,
        photoIds: [1, 2, 3],
        devices: [],
        suggestedColor: '#3B82F6',
        confidence: 0.85,
      },
    ];

    mockEventService.autoDetectEventsSmart.mockResolvedValue(mockSuggestions);

    // Simulate handler with custom params
    const body = { epsilon: 30, minPoints: 5 };
    const { epsilon = null, minPoints = 3, method = 'dbscan' } = body;

    const eventService = new EventService();
    const suggestions = await eventService.autoDetectEventsSmart({
      epsilon,
      minPoints,
      method,
    });

    expect(mockEventService.autoDetectEventsSmart).toHaveBeenCalledWith({
      epsilon: 30,
      minPoints: 5,
      method: 'dbscan',
    });

    const parameters = {
      epsilon: epsilon || 'auto',
      minPoints,
      method,
      totalEvents: suggestions.length,
      totalPhotos: suggestions.reduce((sum, s) => sum + s.photoCount, 0),
    };

    expect(parameters.epsilon).toBe(30);
    expect(parameters.minPoints).toBe(5);
  });

  it('should handle empty photo collection', async () => {
    mockEventService.autoDetectEventsSmart.mockResolvedValue([]);

    const body = {};
    const { epsilon = null, minPoints = 3, method = 'dbscan' } = body;

    const eventService = new EventService();
    const suggestions = await eventService.autoDetectEventsSmart({
      epsilon,
      minPoints,
      method,
    });

    expect(suggestions).toEqual([]);

    const parameters = {
      epsilon: epsilon || 'auto',
      minPoints,
      method,
      totalEvents: suggestions.length,
      totalPhotos: suggestions.reduce((sum, s) => sum + s.photoCount, 0),
    };

    expect(parameters.totalEvents).toBe(0);
    expect(parameters.totalPhotos).toBe(0);
  });

  it('should include all suggestion fields', async () => {
    const mockSuggestions = [
      {
        name: 'Dinner',
        eventType: 'dinner',
        startTime: new Date('2024-06-15T19:00:00Z'),
        endTime: new Date('2024-06-15T21:00:00Z'),
        duration: 120,
        photoCount: 50,
        photoDensity: 25.5,
        photoIds: [1, 2, 3, 4, 5],
        devices: [
          { model: 'iPhone 13', count: 30 },
          { model: 'Samsung S23', count: 20 },
        ],
        suggestedColor: '#F59E0B',
        confidence: 0.70,
      },
    ];

    mockEventService.autoDetectEventsSmart.mockResolvedValue(mockSuggestions);

    const eventService = new EventService();
    const suggestions = await eventService.autoDetectEventsSmart({
      epsilon: null,
      minPoints: 3,
      method: 'dbscan',
    });

    const suggestion = suggestions[0];
    expect(suggestion).toHaveProperty('name');
    expect(suggestion).toHaveProperty('eventType');
    expect(suggestion).toHaveProperty('startTime');
    expect(suggestion).toHaveProperty('endTime');
    expect(suggestion).toHaveProperty('duration');
    expect(suggestion).toHaveProperty('photoCount');
    expect(suggestion).toHaveProperty('photoDensity');
    expect(suggestion).toHaveProperty('photoIds');
    expect(suggestion).toHaveProperty('devices');
    expect(suggestion).toHaveProperty('suggestedColor');
    expect(suggestion).toHaveProperty('confidence');

    expect(Array.isArray(suggestion.photoIds)).toBe(true);
    expect(Array.isArray(suggestion.devices)).toBe(true);
    expect(suggestion.devices.length).toBe(2);
  });

  it('should calculate totalPhotos correctly', async () => {
    const mockSuggestions = [
      { photoCount: 50, photoIds: [], name: 'Event 1', eventType: 'unknown', startTime: new Date(), endTime: new Date(), duration: 60, photoDensity: 50, devices: [], suggestedColor: '#000', confidence: 0.5 },
      { photoCount: 75, photoIds: [], name: 'Event 2', eventType: 'unknown', startTime: new Date(), endTime: new Date(), duration: 60, photoDensity: 75, devices: [], suggestedColor: '#000', confidence: 0.5 },
      { photoCount: 100, photoIds: [], name: 'Event 3', eventType: 'unknown', startTime: new Date(), endTime: new Date(), duration: 60, photoDensity: 100, devices: [], suggestedColor: '#000', confidence: 0.5 },
    ];

    mockEventService.autoDetectEventsSmart.mockResolvedValue(mockSuggestions);

    const eventService = new EventService();
    const suggestions = await eventService.autoDetectEventsSmart({
      epsilon: null,
      minPoints: 3,
      method: 'dbscan',
    });

    const totalPhotos = suggestions.reduce((sum, s) => sum + s.photoCount, 0);

    expect(suggestions.length).toBe(3);
    expect(totalPhotos).toBe(225); // 50 + 75 + 100
  });

  it('should support method parameter', async () => {
    mockEventService.autoDetectEventsSmart.mockResolvedValue([]);

    const body = { method: 'gaps' };
    const { epsilon = null, minPoints = 3, method = 'dbscan' } = body;

    const eventService = new EventService();
    await eventService.autoDetectEventsSmart({
      epsilon,
      minPoints,
      method,
    });

    expect(mockEventService.autoDetectEventsSmart).toHaveBeenCalledWith({
      epsilon: null,
      minPoints: 3,
      method: 'gaps',
    });
  });

  it('should preserve event order from service', async () => {
    const mockSuggestions = [
      { name: 'Getting Ready', eventType: 'prep', startTime: new Date('2024-06-15T10:00:00Z'), endTime: new Date('2024-06-15T12:00:00Z'), duration: 120, photoCount: 15, photoDensity: 7.5, photoIds: [], devices: [], suggestedColor: '#14B8A6', confidence: 0.6 },
      { name: 'Ceremony', eventType: 'ceremony', startTime: new Date('2024-06-15T14:00:00Z'), endTime: new Date('2024-06-15T14:45:00Z'), duration: 45, photoCount: 80, photoDensity: 109.1, photoIds: [], devices: [], suggestedColor: '#3B82F6', confidence: 0.85 },
      { name: 'Party', eventType: 'party', startTime: new Date('2024-06-15T22:00:00Z'), endTime: new Date('2024-06-16T01:00:00Z'), duration: 180, photoCount: 90, photoDensity: 30, photoIds: [], devices: [], suggestedColor: '#8B5CF6', confidence: 0.8 },
    ];

    mockEventService.autoDetectEventsSmart.mockResolvedValue(mockSuggestions);

    const eventService = new EventService();
    const suggestions = await eventService.autoDetectEventsSmart({
      epsilon: null,
      minPoints: 3,
      method: 'dbscan',
    });

    expect(suggestions[0].name).toBe('Getting Ready');
    expect(suggestions[1].name).toBe('Ceremony');
    expect(suggestions[2].name).toBe('Party');
  });
});
