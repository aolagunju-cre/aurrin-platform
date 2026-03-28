/** @jest-environment node */

import { NextRequest } from 'next/server';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest(new Request('http://localhost/api/commerce/founder-support/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('founder support checkout route', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns 400 when payload is invalid', async () => {
    jest.doMock('../src/lib/demo/data', () => ({ DEMO_MODE: false }));
    const { POST } = await import('../src/app/api/commerce/founder-support/checkout/route');

    const response = await POST(buildRequest({ founder_slug: 'maya', amount_cents: 10 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('returns mock success URL in demo mode', async () => {
    const createSession = jest.fn();
    jest.doMock('../src/lib/demo/data', () => ({ DEMO_MODE: true }));
    jest.doMock('../src/lib/payments/stripe-client', () => ({
      getStripeClient: () => ({ checkout: { sessions: { create: createSession } } }),
    }));

    const { POST } = await import('../src/app/api/commerce/founder-support/checkout/route');
    const response = await POST(buildRequest({
      founder_slug: 'maya-chen-terravolt',
      founder_name: 'Maya Chen',
      founder_id: '11111111-1111-4111-8111-111111111111',
      donor_email: 'donor@example.com',
      amount_cents: 2500,
      success_url: 'http://localhost/public/directory/maya-chen-terravolt?support=success',
      cancel_url: 'http://localhost/public/directory/maya-chen-terravolt?support=cancel',
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.checkoutUrl).toContain('demo=1');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('creates Stripe checkout session with founder attribution metadata', async () => {
    const createSession = jest.fn().mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });

    jest.doMock('../src/lib/demo/data', () => ({ DEMO_MODE: false }));
    jest.doMock('../src/lib/payments/stripe-client', () => ({
      getStripeClient: () => ({ checkout: { sessions: { create: createSession } } }),
    }));

    const { POST } = await import('../src/app/api/commerce/founder-support/checkout/route');

    const response = await POST(buildRequest({
      founder_slug: 'maya-chen-terravolt',
      founder_name: 'Maya Chen',
      founder_id: '11111111-1111-4111-8111-111111111111',
      donor_email: 'donor@example.com',
      amount_cents: 1000,
      success_url: 'http://localhost/public/directory/maya-chen-terravolt?support=success',
      cancel_url: 'http://localhost/public/directory/maya-chen-terravolt?support=cancel',
    }));

    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'donor@example.com',
        metadata: expect.objectContaining({
          kind: 'founder_support',
          founder_slug: 'maya-chen-terravolt',
        }),
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({
            donor_email: 'donor@example.com',
          }),
        }),
      })
    );
  });
});
