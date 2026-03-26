import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminSponsorsPage from '../src/app/(protected)/admin/sponsors/page';

describe('AdminSponsorsPage', () => {
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

      if (url.endsWith('/api/admin/sponsors') && method === 'GET') {
        return mockResponse(200, {
          success: true,
          data: [{
            id: 'sponsor-1',
            name: 'Acme Ventures',
            logo: 'https://example.com/logo.png',
            website: 'https://example.com',
            tier: 'silver',
            scope: 'site-wide',
            event: null,
            end_date: '2026-12-31T00:00:00.000Z',
            pricing: 100000,
            status: 'active',
          }],
          tier_config: [
            { tier: 'bronze', pricing_cents: 50000 },
            { tier: 'silver', pricing_cents: 100000 },
            { tier: 'gold', pricing_cents: 250000 },
          ],
        });
      }

      if (url.endsWith('/api/admin/sponsors') && method === 'POST') {
        return mockResponse(201, { success: true, data: { id: 'sponsor-2' } });
      }

      if (url.endsWith('/api/admin/sponsors/sponsor-1') && method === 'PATCH') {
        return mockResponse(200, { success: true, data: { id: 'sponsor-1' } });
      }

      if (url.endsWith('/api/admin/sponsors/sponsor-1') && method === 'DELETE') {
        return mockResponse(200, { success: true });
      }

      return mockResponse(500, { success: false, message: `Unhandled ${method} ${url}` });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;
  });

  it('supports sponsor create/edit/delete flows', async () => {
    render(<AdminSponsorsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Ventures')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Beta Capital' } });
    fireEvent.change(screen.getByLabelText('tier'), { target: { value: 'gold' } });
    fireEvent.change(screen.getByLabelText('scope'), { target: { value: 'site-wide' } });
    fireEvent.change(screen.getByLabelText('end_date'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('pricing'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Sponsor' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/sponsors', expect.objectContaining({ method: 'POST' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/sponsors/sponsor-1', expect.objectContaining({ method: 'PATCH' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/sponsors/sponsor-1', expect.objectContaining({ method: 'DELETE' }));
    });
  });
});
