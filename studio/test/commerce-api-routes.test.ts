/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as getProducts } from '../src/app/api/commerce/products/route';
import { GET as getPrices } from '../src/app/api/commerce/prices/route';
import { POST as postCheckout } from '../src/app/api/commerce/checkout/route';
import { getSupabaseClient } from '../src/lib/db/client';
import { getStripeClient } from '../src/lib/payments/stripe-client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../src/lib/payments/stripe-client', () => ({
  getStripeClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockedGetStripeClient = getStripeClient as jest.MockedFunction<typeof getStripeClient>;

describe('commerce API routes', () => {
  const mockDb = {
    listProducts: jest.fn(),
    listPricesByProductId: jest.fn(),
  };

  const stripeMock = {
    prices: {
      retrieve: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });

    mockedGetStripeClient.mockReturnValue(stripeMock as never);

    mockDb.listProducts.mockResolvedValue({ data: [], error: null });
    mockDb.listPricesByProductId.mockResolvedValue({ data: [], error: null });
    stripeMock.prices.retrieve.mockResolvedValue({ recurring: { interval: 'month' } });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
  });

  it('GET /api/commerce/products returns active products', async () => {
    mockDb.listProducts.mockResolvedValueOnce({
      data: [{ id: 'prod-1', name: 'Starter', active: true }],
      error: null,
    });

    const response = await getProducts();

    expect(response.status).toBe(200);
    expect(mockDb.listProducts).toHaveBeenCalledWith(true);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ id: 'prod-1', name: 'Starter', active: true }],
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

  it('GET /api/commerce/prices returns active product prices', async () => {
    mockDb.listPricesByProductId.mockResolvedValueOnce({
      data: [{ id: 'price-1', product_id: 'prod-1', active: true }],
      error: null,
    });

    const request = new NextRequest('http://localhost/api/commerce/prices?product_id=prod-1');
    const response = await getPrices(request);

    expect(response.status).toBe(200);
    expect(mockDb.listPricesByProductId).toHaveBeenCalledWith('prod-1', true);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{ id: 'price-1', product_id: 'prod-1', active: true }],
    });
  });

  it('POST /api/commerce/checkout requires exact body shape', async () => {
    const request = new NextRequest('http://localhost/api/commerce/checkout', {
      method: 'POST',
      body: JSON.stringify({
        price_id: 'price_123',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        extra: 'not-allowed',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await postCheckout(request);

    expect(response.status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('POST /api/commerce/checkout returns sessionId and checkoutUrl', async () => {
    const request = new NextRequest('http://localhost/api/commerce/checkout', {
      method: 'POST',
      body: JSON.stringify({
        price_id: 'price_123',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await postCheckout(request);

    expect(response.status).toBe(200);
    expect(stripeMock.prices.retrieve).toHaveBeenCalledWith('price_123');
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_123', quantity: 1 }],
      })
    );
    await expect(response.json()).resolves.toEqual({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
  });
});
