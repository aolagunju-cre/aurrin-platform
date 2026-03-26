import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SponsorPlacementSection } from '../src/components/public/SponsorPlacementSection';

describe('SponsorPlacementSection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders sponsor cards in app-shell context', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 's1',
            name: 'Acme Capital',
            logo: 'https://example.com/logo.png',
            link: 'https://acme.example',
            tier: 'gold',
          },
        ],
      }),
    } as Response);

    render(<SponsorPlacementSection />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/public/sponsors');
    });

    expect(await screen.findByRole('heading', { name: 'Our Sponsors' })).toBeInTheDocument();
    expect(screen.getByText('Acme Capital')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Acme Capital logo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Acme Capital/i })).toHaveAttribute('href', 'https://acme.example');
  });

  it('renders sponsor cards in event-detail context', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 's2',
            name: 'Event Partner',
            logo: null,
            link: null,
            tier: 'silver',
          },
        ],
      }),
    } as Response);

    render(<SponsorPlacementSection eventId="event-abc" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/public/sponsors?event_id=event-abc');
    });

    expect(await screen.findByRole('heading', { name: 'Event Sponsors' })).toBeInTheDocument();
    expect(screen.getByText('Event Partner')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Event Partner/i })).not.toBeInTheDocument();
  });
});
