import { createHash } from 'crypto';
import { getSupabaseClient, type FileRecord } from '../../db/client';
import { enqueueJob } from '../enqueue';
import type { JobResult } from '../types';
import { logger } from '../../logging/logger';
import { generateSocialAssetPng } from '../../social-assets/generator';
import {
  parseSocialAssetFormat,
  parseSocialAssetType,
  requiredString,
  type SocialAssetType,
  type SocialAssetFormat,
} from '../../social-assets/types';
import { DEFAULT_RETENTION_DAYS, DEFAULT_SIGNED_URL_EXPIRY } from '../../storage/upload';

type TriggerContext = 'profile_publish' | 'milestone_highlight' | 'event_completion';

export interface AssetPayload extends Record<string, unknown> {
  founder_id?: unknown;
  event_id?: unknown;
  founder_email?: unknown;
  founder_name?: unknown;
  asset_type: unknown;
  format: unknown;
  trigger_context?: unknown;
  milestone_label?: unknown;
}

export interface AssetJobContext {
  jobId?: string;
}

interface CachedJobRow {
  payload: Record<string, unknown>;
}

interface FounderRow {
  id: string;
  user_id: string;
}

const SUPPORTED_HIGHLIGHTS = new Set([
  'Top 10 Scores',
  'Audience Favorite',
  'Highest Investor Interest',
]);

const HASH_EXCLUDED_KEYS = new Set([
  'founder_email',
  'notify_founder',
  'trigger_context',
  'source_hash',
  'asset_url',
  'signed_url',
]);

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveTriggerContext(assetType: SocialAssetType, value: unknown): TriggerContext {
  const normalized = normalizeString(value) as TriggerContext | null;
  if (normalized === 'profile_publish' || normalized === 'milestone_highlight' || normalized === 'event_completion') {
    return normalized;
  }
  if (assetType === 'profile') return 'profile_publish';
  if (assetType === 'highlight') return 'milestone_highlight';
  return 'event_completion';
}

function validateTriggerContext(assetType: SocialAssetType, context: TriggerContext, payload: AssetPayload): string | null {
  if (assetType === 'profile' && context !== 'profile_publish') {
    return 'Profile assets must use trigger_context=profile_publish';
  }
  if (assetType === 'highlight' && context !== 'milestone_highlight') {
    return 'Highlight assets must use trigger_context=milestone_highlight';
  }
  if (assetType === 'event' && context !== 'event_completion') {
    return 'Event assets must use trigger_context=event_completion';
  }
  if (assetType === 'highlight') {
    const milestone = normalizeString(payload.milestone_label ?? payload.milestone);
    if (!milestone || !SUPPORTED_HIGHLIGHTS.has(milestone)) {
      return 'Highlight assets require milestone_label to be one of: Top 10 Scores, Audience Favorite, Highest Investor Interest';
    }
  }
  return null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function buildHashPayload(rawPayload: AssetPayload, assetType: SocialAssetType, format: SocialAssetFormat): Record<string, unknown> {
  const normalizedPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawPayload)) {
    if (HASH_EXCLUDED_KEYS.has(key)) continue;
    normalizedPayload[key] = value;
  }

  return {
    asset_type: assetType,
    format,
    founder_id: rawPayload.founder_id,
    event_id: rawPayload.event_id,
    payload: normalizedPayload,
  };
}

function hashPayload(value: Record<string, unknown>): string {
  const digest = createHash('sha256');
  digest.update(stableStringify(value));
  return digest.digest('hex');
}

function buildStoragePaths(assetType: SocialAssetType, founderId: string, eventId: string, format: SocialAssetFormat): { relative: string; absolute: string } {
  const relative = `${assetType}/${founderId}/${eventId}/${format}.png`;
  return {
    relative,
    absolute: `social-assets/${relative}`,
  };
}

async function findExistingFile(storagePath: string): Promise<FileRecord | null> {
  const client = getSupabaseClient();
  const query = [
    `storage_path=eq.${encodeURIComponent(storagePath)}`,
    'select=*',
    'limit=1',
  ].join('&');
  const result = await client.db.queryTable<FileRecord>('files', query);
  if (result.error) {
    throw result.error;
  }
  return result.data[0] ?? null;
}

async function loadLatestCompletedPayload(
  founderId: string,
  eventId: string,
  assetType: SocialAssetType,
  format: SocialAssetFormat
): Promise<Record<string, unknown> | null> {
  const client = getSupabaseClient();
  const query = [
    'job_type=in.(generate_social_asset,social_asset)',
    'state=eq.completed',
    `payload->>founder_id=eq.${encodeURIComponent(founderId)}`,
    `payload->>event_id=eq.${encodeURIComponent(eventId)}`,
    `payload->>asset_type=eq.${encodeURIComponent(assetType)}`,
    `payload->>format=eq.${encodeURIComponent(format)}`,
    'order=completed_at.desc',
    'select=payload',
    'limit=1',
  ].join('&');
  const result = await client.db.queryTable<CachedJobRow>('outbox_jobs', query);
  if (result.error) {
    throw result.error;
  }
  return result.data[0]?.payload ?? null;
}

async function resolveFounderRecipient(rawPayload: AssetPayload, founderId: string): Promise<{ email: string; name: string | null }> {
  const directEmail = normalizeString(rawPayload.founder_email);
  const directName = normalizeString(rawPayload.founder_name);
  if (directEmail) {
    return { email: directEmail, name: directName };
  }

  const client = getSupabaseClient();
  const founderQuery = `id=eq.${encodeURIComponent(founderId)}&select=id,user_id&limit=1`;
  const founderLookup = await client.db.queryTable<FounderRow>('founders', founderQuery);
  if (founderLookup.error || founderLookup.data.length === 0) {
    throw new Error(founderLookup.error?.message ?? 'Founder record not found for social asset notification');
  }

  const founder = founderLookup.data[0];
  const userLookup = await client.db.getUserById(founder.user_id);
  if (userLookup.error || !userLookup.data?.email) {
    throw new Error(userLookup.error?.message ?? 'Founder user email not found for social asset notification');
  }

  return {
    email: userLookup.data.email,
    name: normalizeString(userLookup.data.name),
  };
}

async function createSignedUrl(relativePath: string, expiry: number): Promise<string> {
  const client = getSupabaseClient();
  const result = await client.storage.createSignedUrl('social-assets', relativePath, expiry);
  if (result.error || !result.signedUrl) {
    throw new Error(result.error?.message ?? 'Failed to create signed URL for social asset');
  }
  return result.signedUrl;
}

async function enqueueFounderNotification(
  recipientEmail: string,
  recipientName: string | null,
  assetUrl: string,
  payload: AssetPayload,
  assetType: SocialAssetType,
  format: SocialAssetFormat,
  founderId: string,
  eventId: string
): Promise<void> {
  await enqueueJob(
    'send_email',
    {
      to: recipientEmail,
      template_name: 'social_asset_ready',
      data: {
        name: recipientName ?? 'Founder',
        link: assetUrl,
        asset_type: assetType,
        format,
        event_id: eventId,
        founder_id: founderId,
        event_name: normalizeString(payload.event_name),
        milestone_label: normalizeString(payload.milestone_label ?? payload.milestone),
      },
    },
    {
      aggregate_id: `${assetType}:${founderId}:${eventId}:${format}`,
      aggregate_type: 'social_asset',
    }
  );
}

export async function handleAssetJob(rawPayload: Record<string, unknown>, context: AssetJobContext = {}): Promise<JobResult> {
  const payload = rawPayload as AssetPayload;
  const assetType = parseSocialAssetType(payload.asset_type);
  if (!assetType) {
    return { success: false, error: 'Asset job invalid asset_type. Expected profile|highlight|event' };
  }

  const format = parseSocialAssetFormat(payload.format);
  if (!format) {
    return { success: false, error: 'Asset job invalid format. Expected twitter|linkedin|og' };
  }

  try {
    const founderId = requiredString(payload.founder_id, 'founder_id');
    const eventId = requiredString(payload.event_id, 'event_id');
    const triggerContext = resolveTriggerContext(assetType, payload.trigger_context);
    const contextError = validateTriggerContext(assetType, triggerContext, payload);
    if (contextError) {
      return { success: false, error: contextError };
    }

    const { relative: relativeStoragePath, absolute: storagePath } = buildStoragePaths(assetType, founderId, eventId, format);
    const hashInput = buildHashPayload(payload, assetType, format);
    const currentHash = hashPayload(hashInput);
    const existingFile = await findExistingFile(storagePath);
    const priorPayload = await loadLatestCompletedPayload(founderId, eventId, assetType, format);
    const priorHash = priorPayload ? hashPayload(buildHashPayload(priorPayload as AssetPayload, assetType, format)) : null;
    const canReuse = Boolean(existingFile && priorHash && priorHash === currentHash);
    const signedUrlExpiry = existingFile?.signed_url_expiry ?? DEFAULT_SIGNED_URL_EXPIRY['social-assets'];

    let signedUrl: string;
    if (canReuse) {
      signedUrl = await createSignedUrl(relativeStoragePath, signedUrlExpiry);
      const recipient = await resolveFounderRecipient(payload, founderId);
      await enqueueFounderNotification(recipient.email, recipient.name, signedUrl, payload, assetType, format, founderId, eventId);
      logger.info('social_asset.job.completed', {
        job_id: context.jobId,
        asset_type: assetType,
        founder_id: founderId,
        event_id: eventId,
        format,
        storage_path: storagePath,
        cached: true,
      });
      return {
        success: true,
        cached: true,
        asset_url: signedUrl,
        storage_path: storagePath,
      };
    }

    const generated = await generateSocialAssetPng({
      asset_type: assetType,
      format,
      payload,
    });

    const client = getSupabaseClient();
    if (existingFile) {
      const deleteResult = await client.storage.remove('social-assets', [relativeStoragePath]);
      if (deleteResult.error) {
        return { success: false, error: `Social asset overwrite cleanup failed: ${deleteResult.error.message}` };
      }
    }
    const uploadResult = await client.storage.upload('social-assets', relativeStoragePath, generated.buffer, {
      contentType: 'image/png',
    });
    if (uploadResult.error) {
      return { success: false, error: `Social asset upload failed: ${uploadResult.error.message}` };
    }

    if (!existingFile) {
      const retentionDays = DEFAULT_RETENTION_DAYS['social-assets'];
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
      const fileInsert = await client.db.insertFile({
        owner_id: founderId,
        file_name: `${format}.png`,
        file_type: 'image/png',
        file_size: generated.buffer.length,
        storage_path: storagePath,
        signed_url_expiry: signedUrlExpiry,
        retention_days: retentionDays,
        is_public: false,
        expires_at: expiresAt,
      });
      if (fileInsert.error || !fileInsert.data) {
        return { success: false, error: `Failed to persist social asset metadata: ${fileInsert.error?.message ?? 'unknown error'}` };
      }
    }

    signedUrl = await createSignedUrl(relativeStoragePath, signedUrlExpiry);
    const recipient = await resolveFounderRecipient(payload, founderId);
    await enqueueFounderNotification(recipient.email, recipient.name, signedUrl, payload, assetType, format, founderId, eventId);

    logger.info('social_asset.job.completed', {
      job_id: context.jobId,
      asset_type: assetType,
      founder_id: founderId,
      event_id: eventId,
      format,
      storage_path: storagePath,
      cached: false,
    });

    return {
      success: true,
      cached: false,
      asset_url: signedUrl,
      storage_path: storagePath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Asset generation failed';
    logger.error('social_asset.job.failed', {
      job_id: context.jobId,
      error: message,
      asset_type: payload.asset_type,
      founder_id: payload.founder_id,
      event_id: payload.event_id,
      format: payload.format,
    });
    return { success: false, error: message };
  }
}
