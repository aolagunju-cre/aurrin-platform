import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { uploadFile, UploadError } from '../../../../../../lib/storage/upload';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid form-data body.' }, { status: 400 });
  }

  const productId = formData.get('product_id');
  const file = formData.get('file');

  if (typeof productId !== 'string' || productId.trim().length === 0) {
    return NextResponse.json({ success: false, message: 'product_id is required.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'file is required.' }, { status: 400 });
  }

  const productResult = await getSupabaseClient().db.getProductById(productId);
  if (productResult.error || !productResult.data || productResult.data.product_type !== 'digital') {
    return NextResponse.json({ success: false, message: 'Digital product not found.' }, { status: 404 });
  }

  try {
    const uploaded = await uploadFile(file, 'generated-reports', auth.userId);
    const updateResult = await getSupabaseClient().db.updateProduct(productId, {
      file_id: uploaded.file_id,
      file_path: uploaded.path,
    });

    if (updateResult.error || !updateResult.data) {
      return NextResponse.json({ success: false, message: 'Could not link uploaded file to product.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        product_id: productId,
        file_id: uploaded.file_id,
        file_path: uploaded.path,
      },
    }, { status: 200 });
  } catch (error) {
    if (error instanceof UploadError) {
      const status = error.code === 'INVALID_MIME_TYPE' || error.code === 'FILE_TOO_LARGE' ? 400 : 500;
      return NextResponse.json({ success: false, message: error.message }, { status });
    }

    return NextResponse.json({ success: false, message: 'Could not upload product file.' }, { status: 500 });
  }
}
