/**
 * Feature Flag Decorators for API Routes (Decorator Pattern)
 *
 * Provides composable decorators to gate API endpoints by feature flags.
 * Works with existing withApi decorator.
 *
 * Usage:
 * ```javascript
 * import { withFeature } from '@/lib/api/featureDecorators';
 *
 * async function handleGet(request) { ... }
 *
 * export const GET = withFeature(handleGet, 'gamification');
 * // or compose: export const GET = withApi(withFeature(handleGet, 'gamification'));
 * ```
 */

import { NextResponse } from 'next/server';
import { FeatureFlagService } from '../services/FeatureFlagService.js';

/**
 * Decorator to gate API endpoints by feature flag
 *
 * @param {Function} handler - API handler function
 * @param {string} feature - Feature name (FeatureFlagService.FEATURES)
 * @param {Object} options - Options
 * @param {boolean} options.returnFlags - Return flags in response (default: true)
 * @returns {Function} Wrapped handler
 */
export function withFeature(handler, feature, options = {}) {
  const { returnFlags = true } = options;

  return async function featureGatedHandler(request, context) {
    const featureFlags = new FeatureFlagService();
    const enabled = await featureFlags.isEnabled(feature);

    // Feature disabled - return 404 or empty response
    if (!enabled) {
      return NextResponse.json({
        success: true,
        data: returnFlags ? { [feature]: false, data: [] } : [],
        message: `Feature "${feature}" is not enabled`,
      });
    }

    // Feature enabled - call handler
    return handler(request, context);
  };
}

/**
 * Check multiple features (all must be enabled)
 *
 * @param {Function} handler - API handler
 * @param {string[]} features - Array of feature names
 * @returns {Function} Wrapped handler
 */
export function withFeatures(handler, features) {
  return async function multiFeatureGatedHandler(request, context) {
    const featureFlags = new FeatureFlagService();

    for (const feature of features) {
      const enabled = await featureFlags.isEnabled(feature);
      if (!enabled) {
        return NextResponse.json({
          success: false,
          error: `Feature "${feature}" is required but not enabled`,
        }, { status: 403 });
      }
    }

    return handler(request, context);
  };
}
