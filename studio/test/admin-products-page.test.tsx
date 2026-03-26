import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminDigitalProductsPage from '../src/app/(protected)/admin/products/digital/page';

describe('AdminDigitalProductsPage', () => {
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

      if (url.endsWith('/api/commerce/products/digital') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: [{
            id: 'prod_digital_1',
            name: 'Market Map',
            description: 'Downloadable report',
            stripe_price_link: 'price_123',
            access_type: 'perpetual',
            file_id: null,
            file_path: null,
            sales_count: 12,
            revenue_cents: 120000,
            status: 'active',
          }],
        });
      }

      if (url.endsWith('/api/commerce/products/digital') && method === 'POST') {
        return mockResponse(201, { success: true, data: { id: 'prod_digital_2' } });
      }

      if (url.endsWith('/api/commerce/products/digital/prod_digital_1') && method === 'PATCH') {
        return mockResponse(200, { success: true, data: { id: 'prod_digital_1' } });
      }

      if (url.endsWith('/api/commerce/products/digital/prod_digital_1') && method === 'DELETE') {
        return mockResponse(200, { success: true });
      }

      if (url.endsWith('/api/commerce/products/digital/upload') && method === 'POST') {
        return mockResponse(200, {
          success: true,
          data: { file_id: 'file_1', file_path: 'generated-reports/admin/asset.zip' },
        });
      }

      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('supports create/edit/delete and upload flows for digital products', async () => {
    render(<AdminDigitalProductsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Market Map')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Founder Playbook' } });
    fireEvent.change(screen.getByLabelText('description'), { target: { value: 'A paid founder guide.' } });
    fireEvent.change(screen.getByLabelText('Stripe price link'), { target: { value: 'price_456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Digital Product' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/digital', expect.objectContaining({ method: 'POST' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/digital/prod_digital_1', expect.objectContaining({ method: 'PATCH' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/digital/prod_digital_1', expect.objectContaining({ method: 'DELETE' }));
    });

    const fileInput = screen.getByLabelText('file upload prod_digital_1') as HTMLInputElement;
    const uploadFile = new File(['dummy'], 'asset.zip', { type: 'application/zip' });
    fireEvent.change(fileInput, { target: { files: [uploadFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/commerce/products/digital/upload', expect.objectContaining({ method: 'POST' }));
    });
  });
});
