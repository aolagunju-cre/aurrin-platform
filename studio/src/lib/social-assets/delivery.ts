import { getSupabaseClient, type FileRecord } from '../db/client';
import { parseSocialAssetFormat, parseSocialAssetType, type SocialAssetFormat, type SocialAssetType } from './types';
import { DEFAULT_SIGNED_URL_EXPIRY } from '../storage/upload';

interface ParsedStoragePath {
  assetType: SocialAssetType;
  founderId: string;
  eventId: string;
  format: SocialAssetFormat;
  relativePath: string;
}

export interface SignedAssetMetadata {
  asset_type: SocialAssetType;
  founder_id: string;
  event_id: string;
  format: SocialAssetFormat;
  storage_path: string;
  signed_download: {
    url: string;
    expires_in: number;
  };
  open_graph_image_url: string | null;
  download_action_label: 'Download Share Card';
}

function parseStoragePath(storagePath: string): ParsedStoragePath | null {
  const match = /^social-assets\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.png$/.exec(storagePath);
  if (!match) {
    return null;
  }

  const assetType = parseSocialAssetType(match[1]);
  const format = parseSocialAssetFormat(match[4]);
  if (!assetType || !format) {
    return null;
  }

  return {
    assetType,
    founderId: match[2],
    eventId: match[3],
    format,
    relativePath: `${match[1]}/${match[2]}/${match[3]}/${match[4]}.png`,
  };
}

async function buildSignedAssetMetadata(file: FileRecord): Promise<SignedAssetMetadata | null> {
  const parsed = parseStoragePath(file.storage_path);
  if (!parsed) {
    return null;
  }

  const expiresIn = file.signed_url_expiry ?? DEFAULT_SIGNED_URL_EXPIRY['social-assets'];
  const signedResult = await getSupabaseClient().storage.createSignedUrl('social-assets', parsed.relativePath, expiresIn);
  if (signedResult.error || !signedResult.signedUrl) {
    throw new Error(signedResult.error?.message ?? 'Failed to create signed URL for social asset metadata');
  }

  return {
    asset_type: parsed.assetType,
    founder_id: parsed.founderId,
    event_id: parsed.eventId,
    format: parsed.format,
    storage_path: file.storage_path,
    signed_download: {
      url: signedResult.signedUrl,
      expires_in: expiresIn,
    },
    open_graph_image_url: parsed.format === 'og' ? signedResult.signedUrl : null,
    download_action_label: 'Download Share Card',
  };
}

export async function loadSignedAssetMetadataByStoragePath(storagePath: string): Promise<SignedAssetMetadata | null> {
  const client = getSupabaseClient();
  const fileResult = await client.db.queryTable<FileRecord>(
    'files',
    `storage_path=eq.${encodeURIComponent(storagePath)}&select=storage_path,signed_url_expiry&limit=1`
  );
  if (fileResult.error) {
    throw new Error(fileResult.error.message);
  }

  const file = fileResult.data[0] ?? null;
  if (!file) {
    return null;
  }

  return buildSignedAssetMetadata(file);
}

export async function listFounderSignedAssetMetadata(founderId: string): Promise<SignedAssetMetadata[]> {
  const client = getSupabaseClient();
  const fileResult = await client.db.queryTable<FileRecord>(
    'files',
    `owner_id=eq.${encodeURIComponent(founderId)}&storage_path=like.${encodeURIComponent(
      'social-assets/%'
    )}&select=storage_path,signed_url_expiry&order=created_at.desc&limit=50`
  );
  if (fileResult.error) {
    throw new Error(fileResult.error.message);
  }

  const signedAssets = await Promise.all(fileResult.data.map((file) => buildSignedAssetMetadata(file)));
  return signedAssets.filter((asset): asset is SignedAssetMetadata => Boolean(asset));
}
