import {
  parseSocialAssetFormat,
  parseSocialAssetType,
  requiredNumber,
  requiredString,
  SOCIAL_ASSET_DIMENSIONS,
  type EventCardData,
  type HighlightCardData,
  type ProfileCardData,
  type SocialAssetFormat,
  type SocialAssetType,
} from './types';
import { loadBrandingConfig } from './branding';

export interface GenerateSocialAssetInput {
  asset_type: unknown;
  format: unknown;
  payload: Record<string, unknown>;
}

interface ParsedRequest {
  assetType: SocialAssetType;
  format: SocialAssetFormat;
  payload: ProfileCardData | HighlightCardData | EventCardData;
}

function parseInput(input: GenerateSocialAssetInput): ParsedRequest {
  const assetType = parseSocialAssetType(input.asset_type);
  if (!assetType) {
    throw new Error('Invalid asset_type. Supported values: profile|highlight|event');
  }

  const format = parseSocialAssetFormat(input.format);
  if (!format) {
    throw new Error('Invalid format. Supported values: twitter|linkedin|og');
  }

  switch (assetType) {
    case 'profile':
      return {
        assetType,
        format,
        payload: {
          founderName: requiredString(input.payload.founder_name, 'founder_name'),
          companyName: requiredString(input.payload.company_name, 'company_name'),
          score: requiredString(input.payload.score, 'score'),
          date: requiredString(input.payload.date, 'date'),
          eventName: typeof input.payload.event_name === 'string' ? input.payload.event_name : undefined,
        },
      };
    case 'highlight':
      return {
        assetType,
        format,
        payload: {
          milestone: requiredString(input.payload.milestone, 'milestone'),
          metric: requiredString(input.payload.metric, 'metric'),
          founderName: requiredString(input.payload.founder_name, 'founder_name'),
          date: requiredString(input.payload.date, 'date'),
        },
      };
    case 'event':
      return {
        assetType,
        format,
        payload: {
          eventName: requiredString(input.payload.event_name, 'event_name'),
          date: requiredString(input.payload.date, 'date'),
          totalFounders: requiredNumber(input.payload.total_founders, 'total_founders'),
          topScore: requiredString(input.payload.top_score, 'top_score'),
          participationSummary: requiredString(input.payload.participation_summary, 'participation_summary'),
        },
      };
  }
}

function templateFingerprint(request: ParsedRequest): string {
  return JSON.stringify({
    assetType: request.assetType,
    format: request.format,
    payload: request.payload,
  });
}

function hashToRgb(value: string): [number, number, number] {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }

  const r = 40 + Math.abs(hash & 0x5f);
  const g = 70 + Math.abs((hash >>> 8) & 0x7f);
  const b = 90 + Math.abs((hash >>> 16) & 0x7f);
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc)]);
}

function createPng(width: number, height: number, color: [number, number, number]): Buffer {
  const bytesPerRow = width * 4;
  const raw = Buffer.allocUnsafe((bytesPerRow + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (bytesPerRow + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelStart = rowStart + 1 + (x * 4);
      raw[pixelStart] = color[0];
      raw[pixelStart + 1] = color[1];
      raw[pixelStart + 2] = color[2];
      raw[pixelStart + 3] = 255;
    }
  }

  const zlib = require('zlib') as typeof import('zlib');
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.concat([
    u32(width),
    u32(height),
    Buffer.from([8, 6, 0, 0, 0]),
  ]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function generateSocialAssetPng(input: GenerateSocialAssetInput): Promise<{ buffer: Buffer; width: number; height: number }> {
  const parsed = parseInput(input);
  const branding = await loadBrandingConfig();
  const { width, height } = SOCIAL_ASSET_DIMENSIONS[parsed.format];

  // Seed is deterministic and includes branding so updated config changes later renders.
  const seed = JSON.stringify({
    template: templateFingerprint(parsed),
    branding: branding.config,
  });
  const color = hashToRgb(seed);

  return {
    buffer: createPng(width, height, color),
    width,
    height,
  };
}
