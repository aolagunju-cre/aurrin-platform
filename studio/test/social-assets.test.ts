import { generateSocialAssetPng } from '../src/lib/social-assets/generator';
import { SOCIAL_ASSET_DIMENSIONS } from '../src/lib/social-assets/types';

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(buffer.subarray(0, 8).equals(signature)).toBe(true);

  const chunkType = buffer.subarray(12, 16).toString('ascii');
  expect(chunkType).toBe('IHDR');

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

describe('social asset generator', () => {
  it('renders deterministic PNG buffers for required formats and dimensions', async () => {
    const profilePayload = {
      founder_name: 'Sam Founder',
      company_name: 'Orbit Labs',
      score: '91.2',
      date: '2026-03-27',
      event_name: 'Spring Demo Day',
    };

    for (const format of Object.keys(SOCIAL_ASSET_DIMENSIONS) as Array<keyof typeof SOCIAL_ASSET_DIMENSIONS>) {
      const result = await generateSocialAssetPng({
        asset_type: 'profile',
        format,
        payload: profilePayload,
      });

      expect(result.buffer.length).toBeGreaterThan(128);
      const dimensions = readPngDimensions(result.buffer);
      expect(dimensions).toEqual(SOCIAL_ASSET_DIMENSIONS[format]);
    }
  });

  it('rejects invalid asset types and formats', async () => {
    await expect(
      generateSocialAssetPng({
        asset_type: 'unknown',
        format: 'twitter',
        payload: {},
      })
    ).rejects.toThrow('Invalid asset_type');

    await expect(
      generateSocialAssetPng({
        asset_type: 'profile',
        format: 'x',
        payload: {},
      })
    ).rejects.toThrow('Invalid format');
  });

  it('enforces required fields per template contract', async () => {
    await expect(
      generateSocialAssetPng({
        asset_type: 'profile',
        format: 'og',
        payload: {
          company_name: 'Orbit Labs',
          score: '91.2',
          date: '2026-03-27',
        },
      })
    ).rejects.toThrow('founder_name');

    await expect(
      generateSocialAssetPng({
        asset_type: 'highlight',
        format: 'og',
        payload: {
          milestone: 'Top 10 Scores',
          founder_name: 'Sam Founder',
          date: '2026-03-27',
        },
      })
    ).rejects.toThrow('metric');

    await expect(
      generateSocialAssetPng({
        asset_type: 'event',
        format: 'og',
        payload: {
          event_name: 'Spring Demo Day',
          date: '2026-03-27',
          top_score: '98',
          participation_summary: '48 founders participated',
        },
      })
    ).rejects.toThrow('total_founders');
  });

  it('does not perform runtime external fetches during rendering', async () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    await generateSocialAssetPng({
      asset_type: 'highlight',
      format: 'linkedin',
      payload: {
        milestone: 'Audience Favorite',
        metric: '4.9/5',
        founder_name: 'Sam Founder',
        date: '2026-03-27',
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = originalFetch;
  });
});
