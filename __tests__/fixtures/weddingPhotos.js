/**
 * Mock wedding photo data for testing event clustering
 *
 * Simulates a realistic wedding timeline with distinct events:
 * - Getting Ready (10am-12pm) - 15 photos
 * - Ceremony (2pm-2:45pm) - 80 photos (high density)
 * - Cocktail Hour (3pm-5pm) - 40 photos
 * - Dinner (6pm-8:30pm) - 50 photos (lower density)
 * - First Dance (8:45pm-9pm) - 25 photos (burst)
 * - Party (9:30pm-12am) - 90 photos (high density)
 */

export function generateWeddingPhotos() {
  const baseDate = new Date('2024-06-15T00:00:00Z');
  const photos = [];
  let photoId = 1;

  // Helper to create photo with timestamp
  const createPhoto = (hourOffset, minuteOffset, deviceModel = 'iPhone 13') => ({
    id: photoId++,
    capturedAt: new Date(baseDate.getTime() + (hourOffset * 60 + minuteOffset) * 60 * 1000),
    deviceModel,
    deviceMake: deviceModel.includes('iPhone') ? 'Apple' : 'Samsung',
  });

  // Getting Ready (10:00-11:45) - 15 photos, sparse
  for (let i = 0; i < 15; i++) {
    photos.push(createPhoto(10, i * 7)); // Every 7 minutes, ends at 11:45
  }

  // GAP: 2 hours 15 minutes (11:45 - 14:00)

  // Ceremony (14:00-14:45) - 80 photos, VERY dense (1 photo per 30s average)
  for (let i = 0; i < 80; i++) {
    const minute = Math.floor(i * 0.56); // Spread over 45 minutes
    photos.push(createPhoto(14, minute, i % 3 === 0 ? 'iPhone 14 Pro' : 'iPhone 13'));
  }

  // GAP: 1 hour 15 minutes (14:45 - 16:00)

  // Cocktail Hour (16:00-17:30) - 40 photos, medium density
  for (let i = 0; i < 40; i++) {
    photos.push(createPhoto(16, i * 2.25)); // Every ~2 minutes, ends at 17:30
  }

  // GAP: 1 hour 30 minutes (17:30 - 19:00)

  // Dinner (19:00-21:00) - 50 photos, lower density
  for (let i = 0; i < 50; i++) {
    photos.push(createPhoto(19, i * 2.4)); // Every ~2.4 minutes
  }

  // GAP: 1 hour (21:00 - 22:00)

  // First Dance (22:00-22:15) - 25 photos, very dense burst
  for (let i = 0; i < 25; i++) {
    const minute = Math.floor(i * 0.6); // 15 minute burst
    photos.push(createPhoto(22, minute, 'Samsung Galaxy S23'));
  }

  // GAP: 1 hour 15 minutes (22:15 - 23:30)

  // Party (23:30-01:00) - 90 photos, high density
  for (let i = 0; i < 90; i++) {
    const minuteOffset = 30 + i; // Every minute for 90 minutes
    photos.push(createPhoto(23, minuteOffset));
  }

  return photos;
}

/**
 * Expected clustering results for validation
 */
export const expectedClusters = {
  // With epsilon=60min, minPoints=3, should detect 6 events
  standard: [
    { name: 'Getting Ready', eventType: 'prep', photoCount: 15 },
    { name: 'Ceremony', eventType: 'ceremony', photoCount: 80 },
    { name: 'Cocktail Hour', eventType: 'cocktails', photoCount: 40 },
    { name: 'Dinner', eventType: 'dinner', photoCount: 50 },
    { name: 'First Dance', eventType: 'first_dance', photoCount: 25 },
    { name: 'Party Time', eventType: 'party', photoCount: 90 },
  ],

  // With tight clustering (epsilon=30min), might detect more granular events
  tight: {
    minClusters: 6,
    maxClusters: 10,
  },

  // With loose clustering (epsilon=120min), might merge some events
  loose: {
    minClusters: 3,
    maxClusters: 5,
  }
};

/**
 * Edge case test data
 */
export const edgeCasePhotos = {
  // Empty album
  empty: [],

  // Single photo
  single: [
    { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' }
  ],

  // Two photos with huge gap (24 hours)
  hugeGap: [
    { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' },
    { id: 2, capturedAt: new Date('2024-06-16T14:00:00Z'), deviceModel: 'iPhone 13' },
  ],

  // Many photos in very short time (burst mode)
  burst: Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    capturedAt: new Date(new Date('2024-06-15T14:00:00Z').getTime() + i * 1000), // 1 second apart
    deviceModel: 'iPhone 13'
  })),

  // Photos with no device info
  noDevice: [
    { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z') },
    { id: 2, capturedAt: new Date('2024-06-15T14:05:00Z') },
    { id: 3, capturedAt: new Date('2024-06-15T14:10:00Z') },
  ]
};
