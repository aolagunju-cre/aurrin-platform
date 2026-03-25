import type { JobResult } from '../types';

/**
 * Social asset generation handler (stub).
 * Will be fully implemented by the Social Asset Generation issue (issue #40).
 * Generates OG images and social cards via Satori.
 */
export interface AssetPayload {
  founder_id: string;
  event_id: string;
  asset_type: 'og_image' | 'social_card' | 'certificate';
}

export async function handleAssetJob(payload: Record<string, unknown>): Promise<JobResult> {
  const { founder_id, asset_type } = payload as unknown as AssetPayload;
  if (!founder_id || !asset_type) {
    return { success: false, error: 'Asset job missing required fields: founder_id, asset_type' };
  }
  // Stub — real Satori-based generation implemented in issue #40
  return { success: true };
}
