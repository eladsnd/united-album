/**
 * Feature Flags API (Public Endpoint)
 *
 * Provides read-only access to feature flags for frontend.
 * Lightweight endpoint for React hooks.
 *
 * Endpoints:
 * - GET /api/features - Get all feature flags
 * - GET /api/features?feature=gamification - Get specific flag
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { FeatureFlagService } from '@/lib/services/FeatureFlagService';

async function handleGet(request) {
  const { searchParams } = new URL(request.url);
  const feature = searchParams.get('feature');
  const featureFlags = new FeatureFlagService();

  // Get specific feature
  if (feature) {
    const enabled = await featureFlags.isEnabled(feature);
    return NextResponse.json({
      success: true,
      data: { feature, enabled },
    });
  }

  // Get all features
  const flags = await featureFlags.getAllFlags();
  return NextResponse.json({
    success: true,
    data: flags,
  });
}

export const GET = withApi(handleGet);
