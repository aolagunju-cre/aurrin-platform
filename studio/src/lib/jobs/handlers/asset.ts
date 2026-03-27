import type { JobResult } from '../types';
import { generateSocialAssetPng } from '../../social-assets/generator';
import { parseSocialAssetFormat, parseSocialAssetType, requiredString } from '../../social-assets/types';

export interface AssetPayload extends Record<string, unknown> {
  founder_id?: string;
  event_id?: string;
  asset_type: unknown;
  format: unknown;
}

export async function handleAssetJob(payload: Record<string, unknown>): Promise<JobResult> {
  const typedPayload = payload as AssetPayload;
  const assetType = parseSocialAssetType(typedPayload.asset_type);
  if (!assetType) {
    return { success: false, error: 'Asset job invalid asset_type. Expected profile|highlight|event' };
  }

  const format = parseSocialAssetFormat(typedPayload.format);
  if (!format) {
    return { success: false, error: 'Asset job invalid format. Expected twitter|linkedin|og' };
  }

  try {
    if (assetType === 'profile') {
      requiredString(typedPayload.founder_id, 'founder_id');
      requiredString(typedPayload.event_id, 'event_id');
    }
    if (assetType === 'event') {
      requiredString(typedPayload.event_id, 'event_id');
    }

    await generateSocialAssetPng({
      asset_type: assetType,
      format,
      payload,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Asset generation failed' };
  }
}
