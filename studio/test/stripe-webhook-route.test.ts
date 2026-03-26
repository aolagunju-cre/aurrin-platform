/** @jest-environment node */

import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { POST as stripeWebhookRoute } from '../src/app/api/commerce/webhooks/stripe/route';
import { getStripeClient, getStripeEnv } from '../src/lib/payments/stripe-client';
import { handleStripeWebhookEvent } from '../src/lib/payments/webhook-handler';

jest.mock('../src/lib/payments/stripe-client', () => ({
  getStripeClient: jest.fn(),
  getStripeEnv: jest.fn(),
}));

jest.mock('../src/lib/payments/webhook-handler', () => ({
  handleStripeWebhookEvent: jest.fn(),
}));

const mockedGetStripeClient = getStripeClient as jest.MockedFunction<typeof getStripeClient>;
const mockedGetStripeEnv = getStripeEnv as jest.MockedFunction<typeof getStripeEnv>;
const mockedHandleStripeWebhookEvent = handleStripeWebhookEvent as jest.MockedFunction<typeof handleStripeWebhookEvent>;

describe('stripe webhook route', () => {
  const constructEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStripeEnv.mockReturnValue({
      secretKey: 'sk_test_123',
      publishableKey: 'pk_test_123',
      webhookSecret: 'whsec_123',
    });
    mockedGetStripeClient.mockReturnValue({
      webhooks: {
        constructEvent,
      },
    } as never);
    mockedHandleStripeWebhookEvent.mockResolvedValue({ duplicate: false, deadLettered: false });
  });

  it('returns 403 when signature verification fails', async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });

    const request = new NextRequest('http://localhost/api/commerce/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_123' }),
      headers: { 'stripe-signature': 'bad-signature' },
    });

    const response = await stripeWebhookRoute(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, message: 'Invalid Stripe signature.' });
  });

  it('returns 200 and forwards replay-safe result', async () => {
    const event = {
      id: 'evt_abc',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event;

    constructEvent.mockReturnValueOnce(event);
    mockedHandleStripeWebhookEvent.mockResolvedValueOnce({ duplicate: true, deadLettered: false });

    const request = new NextRequest('http://localhost/api/commerce/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_abc' }),
      headers: { 'stripe-signature': 'sig_123' },
    });

    const response = await stripeWebhookRoute(request);

    expect(response.status).toBe(200);
    expect(mockedHandleStripeWebhookEvent).toHaveBeenCalledWith(event);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true, deadLettered: false });
  });
});
