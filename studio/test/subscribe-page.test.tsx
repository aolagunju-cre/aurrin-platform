import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubscribePage from '../src/app/public/subscribe/[priceId]/page';

describe('SubscribePage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/commerce/prices/price_1/details') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: {
            product: { id: 'prod_1', name: 'Gold Plan', description: 'All premium features' },
            price: { id: 'price_1', amount_cents: 9900, currency: 'USD', billing_interval: 'monthly' },
          },
        });
      }
      if (url.endsWith('/api/commerce/checkout') && method === 'POST') {
        return mockResponse(200, { sessionId: 'cs_test', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test' });
      }
      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('renders plan details and triggers checkout on Subscribe', async () => {
    const view = await SubscribePage({ params: Promise.resolve({ priceId: 'price_1' }) });
    render(view);

    await waitFor(() => {
      expect(screen.getByText(/Gold Plan/)).toBeInTheDocument();
    });

    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Billing period')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/commerce/checkout',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
