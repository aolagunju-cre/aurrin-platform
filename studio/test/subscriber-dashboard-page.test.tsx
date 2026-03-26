import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubscriberPage from '../src/app/(protected)/subscriber/page';

describe('SubscriberPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/subscriber/subscriptions') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: [{
            id: 'sub_1',
            price_id: 'price_1',
            status: 'active',
            current_period_end: '2026-04-30T00:00:00.000Z',
            stripe_customer_id: 'cus_1',
          }],
        });
      }
      if (url.includes('/api/commerce/prices/price_1/details') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: {
            product: { id: 'prod_1', name: 'Gold Plan' },
            price: { id: 'price_1', amount_cents: 9900, currency: 'USD' },
          },
        });
      }
      if (url.includes('/api/subscriber/subscriptions/sub_1/portal') && method === 'POST') {
        return mockResponse(200, { success: true, data: { url: 'https://billing.stripe.com/session/test' } });
      }
      if (url.includes('/api/subscriber/subscriptions/sub_1/cancel') && method === 'POST') {
        return mockResponse(200, { success: true });
      }
      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('lists subscriptions and supports Cancel Subscription action', async () => {
    render(<SubscriberPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Subscriptions Table')).toBeInTheDocument();
    });

    expect(screen.getByText('Gold Plan')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Subscription' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Subscription' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/subscriber/subscriptions/sub_1/cancel', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('supports Manage action for customer portal', async () => {
    render(<SubscriberPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Subscriptions Table')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/subscriber/subscriptions/sub_1/portal', expect.objectContaining({ method: 'POST' }));
    });
  });
});
