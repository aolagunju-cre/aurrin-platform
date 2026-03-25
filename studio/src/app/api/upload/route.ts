/**
 * POST /api/upload
 *
 * Accepts multipart/form-data with:
 *   - `file`: the file to upload
 *   - `bucket`: target Supabase Storage bucket
 *
 * Returns: { file_id, path, signed_url }
 *
 * Enforces authentication via a Bearer token and records ownership using the
 * verified JWT subject.
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, SupportedBucket, UploadError } from '../../../lib/storage/upload';
import { getSignedUrl, SignedUrlError } from '../../../lib/storage/signedUrl';
import { extractTokenFromHeader, verifyJWT } from '../../../lib/auth/jwt';

const VALID_BUCKETS: SupportedBucket[] = [
  'pitch-decks',
  'generated-reports',
  'social-assets',
  'exports',
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: missing or invalid token' }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
  }

  // Parse multipart body
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request: expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  const bucket = formData.get('bucket');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
  }

  if (!bucket || typeof bucket !== 'string') {
    return NextResponse.json({ error: 'Missing required field: bucket' }, { status: 400 });
  }

  if (!VALID_BUCKETS.includes(bucket as SupportedBucket)) {
    return NextResponse.json(
      { error: `Invalid bucket '${bucket}'. Valid buckets: ${VALID_BUCKETS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const uploadResult = await uploadFile(file, bucket as SupportedBucket, payload.sub);

    // Generate a signed URL immediately so the client can use the file right away
    const signedUrl = await getSignedUrl(uploadResult.file_id, payload.sub);

    return NextResponse.json({
      file_id: uploadResult.file_id,
      path: uploadResult.path,
      signed_url: signedUrl,
    });
  } catch (err) {
    if (err instanceof UploadError) {
      const status =
        err.code === 'INVALID_MIME_TYPE' || err.code === 'FILE_TOO_LARGE' ? 400 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    if (err instanceof SignedUrlError) {
      return NextResponse.json(
        { error: `Signed URL error: ${err.message}` },
        { status: 500 }
      );
    }
    console.error('Unexpected upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
