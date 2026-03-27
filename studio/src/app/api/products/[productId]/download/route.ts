import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../../lib/db/client';
import { hasEntitlement } from '../../../../../lib/payments/entitlements';
import { SignedUrlError, getSignedUrlForEntitlement } from '../../../../../lib/storage/signedUrl';
import { resolveAuthIdentityFromRequest } from '../../../../../lib/auth/request-auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
): Promise<NextResponse> {
  const identity = await resolveAuthIdentityFromRequest(request);

  if (!identity?.userId) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const { productId } = await context.params;
  const client = getSupabaseClient();
  const productResult = await client.db.getProductById(productId);

  if (productResult.error) {
    return NextResponse.json({ success: false, message: 'Could not load product.' }, { status: 500 });
  }
  if (!productResult.data || productResult.data.product_type !== 'digital' || !productResult.data.file_id) {
    return NextResponse.json({ success: false, message: 'Product download not available.' }, { status: 404 });
  }

  const entitled = await hasEntitlement(identity.userId, productId);
  if (!entitled) {
    return NextResponse.json({ success: false, message: 'Entitlement required.' }, { status: 403 });
  }

  try {
    const signedUrl = await getSignedUrlForEntitlement(productResult.data.file_id);
    return NextResponse.json({
      success: true,
      data: {
        product_id: productId,
        signed_url: signedUrl,
      },
    }, { status: 200 });
  } catch (error) {
    if (error instanceof SignedUrlError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ success: false, message: 'Product file not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: false, message: 'Could not generate download URL.' }, { status: 500 });
  }
}
