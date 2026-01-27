/**
 * Photo Clustering Service
 *
 * Advanced photo event detection using DBSCAN clustering algorithm.
 * Analyzes temporal patterns and photo density to identify natural event boundaries.
 *
 * Research-based approach:
 * - DBSCAN clustering for temporal data (density-based)
 * - Pattern recognition for wedding event types
 * - Smart event naming based on time-of-day and duration heuristics
 *
 * References:
 * - "Temporal event clustering for digital photo collections" (ACM 2005)
 * - "Automated event clustering for digital albuming" (ResearchGate)
 * - density-clustering npm package (DBSCAN implementation)
 *
 * @see https://www.npmjs.com/package/density-clustering
 * @see https://dl.acm.com/doi/10.1145/1083314.1083317
 */

import clustering from 'density-clustering';

export class PhotoClusteringService {
  constructor() {
    // density-clustering is a CommonJS module
    this.dbscan = new clustering.DBSCAN();
  }

  /**
   * Cluster photos into events using DBSCAN algorithm
   *
   * DBSCAN advantages over k-means:
   * - No need to specify number of clusters
   * - Finds arbitrarily shaped clusters
   * - Robust to outliers (isolated photos)
   * - Natural for time-series data
   *
   * @param {Array} photos - Photos with capturedAt timestamps
   * @param {Object} options - Clustering options
   * @param {number} options.epsilon - Max time gap in minutes (default: 60)
   * @param {number} options.minPoints - Min photos per cluster (default: 3)
   * @returns {Array} Event clusters with metadata
   */
  clusterPhotosByTime(photos, options = {}) {
    const { epsilon = 60, minPoints = 3 } = options;

    if (!photos || photos.length === 0) {
      return [];
    }

    // Sort photos chronologically
    const sortedPhotos = [...photos].sort((a, b) =>
      new Date(a.capturedAt) - new Date(b.capturedAt)
    );

    // Convert timestamps to 1D array (minutes since first photo)
    const firstTime = new Date(sortedPhotos[0].capturedAt).getTime();
    const timePoints = sortedPhotos.map(p => {
      const timeMs = new Date(p.capturedAt).getTime();
      const minutesSinceFirst = (timeMs - firstTime) / (1000 * 60);
      return [minutesSinceFirst]; // DBSCAN expects array of arrays
    });

    // Run DBSCAN clustering
    // epsilon: max minutes between photos in same cluster
    // minPoints: min photos to form a dense cluster
    const clusters = this.dbscan.run(timePoints, epsilon, minPoints);

    // DBSCAN returns array of clusters, each cluster is array of photo indices
    // Example: [[0,1,2,3], [7,8,9,10], [15,16,17]]
    // Noise points (outliers) are in separate array

    console.log(`[PhotoClustering] DBSCAN found ${clusters.length} clusters with epsilon=${epsilon}min, minPoints=${minPoints}`);

    // Convert clusters to event objects
    const events = clusters.map((clusterIndices, clusterIdx) => {
      const clusterPhotos = clusterIndices.map(idx => sortedPhotos[idx]);

      return this._buildEventFromCluster(clusterPhotos, clusterIdx, sortedPhotos);
    });

    // Filter out very small clusters (likely noise)
    return events.filter(e => e.photoCount >= minPoints);
  }

  /**
   * Build event object from photo cluster
   * @private
   */
  _buildEventFromCluster(photos, index, allPhotos) {
    const startTime = new Date(photos[0].capturedAt);
    const endTime = new Date(photos[photos.length - 1].capturedAt);
    const duration = (endTime - startTime) / (1000 * 60); // minutes

    // Detect event type based on patterns
    const eventType = this._detectEventType(photos, startTime, duration);

    // Extract metadata
    const devices = this._extractDevices(photos);
    const photoIds = photos.map(p => p.id);

    return {
      name: eventType.name,
      startTime,
      endTime,
      photoCount: photos.length,
      photoIds,
      duration: Math.round(duration),
      photoDensity: photos.length / Math.max(duration / 60, 0.1), // photos per hour
      devices,
      suggestedColor: this._getColorForEventType(eventType.type),
      eventType: eventType.type,
      confidence: eventType.confidence,
    };
  }

  /**
   * Detect wedding event type using heuristics
   *
   * Wedding timeline patterns (research-based):
   * - Ceremony: 30-45min, high photo density, early afternoon
   * - Cocktail Hour: 60-90min, medium density, follows ceremony
   * - Dinner: 90-180min, low-medium density, evening
   * - First Dance: 15-30min, high density burst
   * - Party/Dancing: 120-300min, high density, late evening
   *
   * @private
   */
  _detectEventType(photos, startTime, duration) {
    const hour = startTime.getHours();
    const photoDensity = photos.length / Math.max(duration / 60, 0.1);

    // Ceremony detection
    if (duration >= 20 && duration <= 60 && photoDensity > 15 && hour >= 13 && hour <= 17) {
      return { name: 'Ceremony', type: 'ceremony', confidence: 0.85 };
    }

    // Cocktail hour detection
    if (duration >= 45 && duration <= 120 && hour >= 16 && hour <= 19) {
      return { name: 'Cocktail Hour', type: 'cocktails', confidence: 0.75 };
    }

    // Dinner detection
    if (duration >= 60 && duration <= 240 && photoDensity < 30 && hour >= 18 && hour <= 22) {
      return { name: 'Dinner', type: 'dinner', confidence: 0.70 };
    }

    // First dance / special moment
    if (duration >= 10 && duration <= 40 && photoDensity > 20) {
      return { name: 'First Dance', type: 'first_dance', confidence: 0.65 };
    }

    // Party / dancing
    if (duration >= 85 && photoDensity > 12 && hour >= 20) {
      return { name: 'Party Time', type: 'party', confidence: 0.80 };
    }

    // Getting ready / pre-ceremony
    if (hour >= 10 && hour <= 14 && duration < 120) {
      return { name: 'Getting Ready', type: 'prep', confidence: 0.60 };
    }

    // Default: time-based naming
    const timeOfDay = this._getTimeOfDayLabel(hour);
    return {
      name: `Event ${timeOfDay}`,
      type: 'unknown',
      confidence: 0.40
    };
  }

  /**
   * Get time of day label
   * @private
   */
  _getTimeOfDayLabel(hour) {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  }

  /**
   * Get color for event type
   * @private
   */
  _getColorForEventType(type) {
    const colors = {
      ceremony: '#3B82F6',     // Blue
      cocktails: '#10B981',    // Green
      dinner: '#F59E0B',       // Amber
      first_dance: '#EC4899',  // Pink
      party: '#8B5CF6',        // Purple
      prep: '#14B8A6',         // Teal
      unknown: '#6B7280',      // Gray
    };
    return colors[type] || colors.unknown;
  }

  /**
   * Extract device breakdown from photos
   * @private
   */
  _extractDevices(photos) {
    const devices = {};
    photos.forEach(photo => {
      if (photo.deviceModel) {
        const key = photo.deviceMake
          ? `${photo.deviceMake} ${photo.deviceModel}`
          : photo.deviceModel;
        devices[key] = (devices[key] || 0) + 1;
      }
    });
    return Object.entries(devices).map(([model, count]) => ({ model, count }));
  }

  /**
   * Suggest optimal epsilon (time gap threshold) for photos
   *
   * Analyzes time gaps between photos and suggests epsilon using
   * "elbow method" - finds natural separation point.
   *
   * @param {Array} photos - Photos with capturedAt
   * @returns {number} Suggested epsilon in minutes
   */
  suggestEpsilon(photos) {
    if (!photos || photos.length < 2) {
      return 60; // default 1 hour
    }

    const sortedPhotos = [...photos].sort((a, b) =>
      new Date(a.capturedAt) - new Date(b.capturedAt)
    );

    // Calculate all time gaps
    const gaps = [];
    for (let i = 1; i < sortedPhotos.length; i++) {
      const gap = (new Date(sortedPhotos[i].capturedAt) - new Date(sortedPhotos[i-1].capturedAt)) / (1000 * 60);
      gaps.push(gap);
    }

    // Sort gaps to find natural separation
    const sortedGaps = gaps.sort((a, b) => a - b);

    // Use 75th percentile as epsilon (balances precision and recall)
    const percentile75Index = Math.floor(sortedGaps.length * 0.75);
    const suggested = Math.round(sortedGaps[percentile75Index]);

    console.log(`[PhotoClustering] Suggested epsilon: ${suggested} minutes (from ${gaps.length} gaps)`);
    return Math.max(30, Math.min(suggested, 180)); // Clamp between 30min and 3hrs
  }

  /**
   * Split an event at a specific timestamp
   *
   * Allows manual correction of clustering mistakes.
   *
   * @param {Array} photos - Photos in the event
   * @param {Date} splitTime - Time to split at
   * @returns {Array} Two new event clusters
   */
  splitEventAt(photos, splitTime) {
    const splitMs = new Date(splitTime).getTime();

    const before = photos.filter(p => new Date(p.capturedAt) <= splitMs);
    const after = photos.filter(p => new Date(p.capturedAt) > splitMs);

    const events = [];
    if (before.length > 0) {
      events.push(this._buildEventFromCluster(before, 0, photos));
    }
    if (after.length > 0) {
      events.push(this._buildEventFromCluster(after, 1, photos));
    }

    return events;
  }

  /**
   * Merge multiple events into one
   *
   * @param {Array} photoGroups - Array of photo arrays to merge
   * @returns {Object} Merged event
   */
  mergeEvents(photoGroups) {
    const allPhotos = photoGroups.flat();
    const sortedPhotos = allPhotos.sort((a, b) =>
      new Date(a.capturedAt) - new Date(b.capturedAt)
    );

    return this._buildEventFromCluster(sortedPhotos, 0, sortedPhotos);
  }
}
