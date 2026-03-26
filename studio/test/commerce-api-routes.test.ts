/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getPrices } from '../src/app/api/commerce/prices/route';
import { GET as getDigitalProducts, POST as postDigitalProducts } from '../src/app/api/commerce/products/digital/route';
import { PATCH as patchDigitalProduct, DELETE as deleteDigitalProduct } from '../src/app/api/commerce/products/digital/[id]/route';
import { POST as uploadDigitalFile } from '../src/app/api/commerce/products/digital/upload/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { requireAdmin } from '../src/lib/auth/admin';
import { uploadFile } from '../src/lib/storage/upload';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/auth/admin', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('../src/lib/audit/log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/lib/storage/upload', () => ({
  uploadFile: jest.fn(),
  UploadError: class UploadError extends Error {},
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;

describe('commerce API routes', () => {
  const mockDb = {
    listProducts: jest.fn(),
    insertProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
    getProductById: jest.fn(),
    listPricesByProductId: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedRequireAdmin.mockResolvedValue({
      userId: 'admin_1',
      auth: {} as never,
    });

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });

    mockDb.listPricesByProductId.mockResolvedValue({ data: [], error: null });
    mockDb.listProducts.mockResolvedValue({ data: [], error: null });
    mockDb.insertProduct.mockResolvedValue({ data: { id: 'prod_digital_1' }, error: null });
    mockDb.updateProduct.mockResolvedValue({ data: { id: 'prod_digital_1' }, error: null });
    mockDb.deleteProduct.mockResolvedValue({ error: null });
    mockDb.getProductById.mockResolvedValue({
      data: { id: 'prod_digital_1', product_type: 'digital' },
      error: null,
    });

    mockedUploadFile.mockResolvedValue({
      file_id: 'file_1',
      path: 'generated-reports/admin_1/example.zip',
    });
  });

  it('GET /api/commerce/prices validates product_id', async () => {
    const request = new NextRequest('http://localhost/api/commerce/prices');
    const response = await getPrices(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'product_id query parameter is required.',
      },
    });
  });

  it('GET /api/commerce/products/digital requires admin auth', async () => {
    mockedRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    );

    const response = await getDigitalProducts(new NextRequest('http://localhost/api/commerce/products/digital'));
    expect(response.status).toBe(401);
  });

  it('POST /api/commerce/products/digital returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost/api/commerce/products/digital', {
      method: 'POST',
      body: JSON.stringify({ name: 'Only name' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await postDigitalProducts(request);
    expect(response.status).toBe(400);
  });

  it('POST /api/commerce/products/digital creates a digital product', async () => {
    const request = new NextRequest('http://localhost/api/commerce/products/digital', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Market Report',
        description: 'PDF report',
        stripe_price_link: 'price_123',
        access_type: 'perpetual',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await postDigitalProducts(request);
    expect(response.status).toBe(201);
    expect(mockDb.insertProduct).toHaveBeenCalledWith(expect.objectContaining({
      product_type: 'digital',
      access_type: 'perpetual',
      stripe_product_id: 'price_123',
    }));
  });

  it('PATCH and DELETE /api/commerce/products/digital/[id] use admin-only operations', async () => {
    const patchRequest = new NextRequest('http://localhost/api/commerce/products/digital/prod_digital_1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Updated Name',
        description: 'Updated description',
        stripe_price_link: 'price_987',
        access_type: 'time-limited',
        status: 'active',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const patchResponse = await patchDigitalProduct(patchRequest, { params: Promise.resolve({ id: 'prod_digital_1' }) });
    expect(patchResponse.status).toBe(200);
    expect(mockDb.updateProduct).toHaveBeenCalledWith(
      'prod_digital_1',
      expect.objectContaining({ access_type: 'time-limited', stripe_product_id: 'price_987' })
    );

    const deleteRequest = new NextRequest('http://localhost/api/commerce/products/digital/prod_digital_1', { method: 'DELETE' });
    const deleteResponse = await deleteDigitalProduct(deleteRequest, { params: Promise.resolve({ id: 'prod_digital_1' }) });
    expect(deleteResponse.status).toBe(200);
    expect(mockDb.deleteProduct).toHaveBeenCalledWith('prod_digital_1');
  });

  it('POST /api/commerce/products/digital/upload uploads to generated-reports and links file', async () => {
    const formData = new FormData();
    formData.append('product_id', 'prod_digital_1');
    formData.append('file', new File(['zip-data'], 'bundle.zip', { type: 'application/zip' }));

    const request = new NextRequest('http://localhost/api/commerce/products/digital/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await uploadDigitalFile(request);
    expect(response.status).toBe(200);
    expect(mockedUploadFile).toHaveBeenCalledWith(expect.any(File), 'generated-reports', 'admin_1');
    expect(mockDb.updateProduct).toHaveBeenCalledWith('prod_digital_1', expect.objectContaining({
      file_id: 'file_1',
      file_path: 'generated-reports/admin_1/example.zip',
    }));
  });
});
