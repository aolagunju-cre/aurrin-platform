import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminProductsPage from '../src/app/(protected)/admin/products/page';

describe('AdminProductsPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    const mockResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/commerce/products') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: [{ id: 'prod_1', name: 'Gold Plan', description: 'Priority support', stripe_product_id: 'sp_1', active: true }],
        });
      }
      if (url.includes('/api/commerce/prices?product_id=prod_1') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: [{
            id: 'price_1',
            product_id: 'prod_1',
            stripe_price_id: 'spr_1',
            amount_cents: 9900,
            currency: 'USD',
            billing_interval: 'monthly',
            active: true,
          }],
        });
      }
      if (url.endsWith('/api/commerce/products') && method === 'POST') {
        return mockResponse(201, { success: true, data: { id: 'prod_2' } });
      }
      if (url.includes('/api/commerce/products/prod_1') && method === 'PATCH') {
        return mockResponse(200, { success: true, data: { id: 'prod_1' } });
      }
      if (url.includes('/api/commerce/products/prod_1') && method === 'DELETE') {
        return mockResponse(200, { success: true });
      }
      if (url.endsWith('/api/commerce/prices') && method === 'POST') {
        return mockResponse(201, { success: true, data: { id: 'price_2' } });
      }
      if (url.includes('/api/commerce/prices/price_1') && method === 'PATCH') {
        return mockResponse(200, { success: true, data: { id: 'price_1' } });
      }
      if (url.includes('/api/commerce/prices/price_1') && method === 'DELETE') {
        return mockResponse(200, { success: true });
      }
      if (url.endsWith('/api/commerce/products/sync') && method === 'POST') {
        return mockResponse(200, { success: true, data: { createdProducts: 1 } });
      }

      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('supports create/edit/delete product and price plus sync action', async () => {
    render(<AdminProductsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Gold Plan')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Starter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products', expect.objectContaining({ method: 'POST' }));
    });

    fireEvent.click(screen.getByText('Save Product'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/prod_1', expect.objectContaining({ method: 'PATCH' }));
    });

    fireEvent.click(screen.getByText('Delete Product'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/prod_1', expect.objectContaining({ method: 'DELETE' }));
    });

    fireEvent.change(screen.getByLabelText('New price amount prod_1'), { target: { value: '12900' } });
    fireEvent.click(screen.getByText('Create Price'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/prices', expect.objectContaining({ method: 'POST' }));
    });

    fireEvent.click(screen.getByText('Save Price'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/prices/price_1', expect.objectContaining({ method: 'PATCH' }));
    });

    fireEvent.click(screen.getByText('Delete Price'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/prices/price_1', expect.objectContaining({ method: 'DELETE' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sync from Stripe' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/sync', { method: 'POST' });
    });
  });
});
