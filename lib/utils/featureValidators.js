/**
 * Feature Flag Validators for Service Methods
 *
 * Provides decorators and validators for service layer methods.
 * Throws errors when features are disabled.
 *
 * Usage:
 * ```javascript
 * import { requiresFeature } from '@/lib/utils/featureValidators';
 *
 * class MyService {
 *   async myMethod() {
 *     await requiresFeature('gamification');
 *     // ... business logic
 *   }
 * }
 * ```
 */

import { FeatureFlagService } from '../services/FeatureFlagService.js';

/**
 * Validate that a feature is enabled
 * Throws error if disabled
 *
 * @param {string} feature - Feature name
 * @throws {Error} If feature is disabled
 */
export async function requiresFeature(feature) {
  const flags = new FeatureFlagService();
  const enabled = await flags.isEnabled(feature);

  if (!enabled) {
    throw new Error(`Feature "${feature}" is not enabled`);
  }
}

/**
 * Method decorator to require a feature
 * Use with ES decorators (future) or manually wrap methods
 *
 * @param {string} feature - Feature name
 * @returns {Function} Method decorator
 */
export function RequiresFeature(feature) {
  return function decorator(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      await requiresFeature(feature);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
