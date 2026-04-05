import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FounderDashboardNewPage from '../src/app/(protected)/founder/dashboard/page';

// Mock qrcode dynamic import used inside the page
jest.mock('qrcode', () => ({
  default: {
    toCanvas: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('founder dashboard page (/founder/dashboard)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    // Restore qrcode mock after restoreAllMocks
    jest.mock('qrcode', () => ({
      default: { toCanvas: jest.fn().mockResolvedValue(undefined) },
    }));
  });

  function mockFetch(overrides?: {
    profile?: Record<string, unknown> | null;
    goalCents?: number | null;
    profileOk?: boolean;
  }): void {
    const profileData = overrides?.profile !== undefined
      ? overrides.profile
      : {
          founder_id: 'founder-1',
          name: 'Maya Chen',
          email: 'maya@example.com',
          company_name: 'TerraVolt Energy',
          pitch_summary: 'Clean energy for northern communities.',
          website: 'https://terravolt.ca',
        };

    const goalCents = overrides?.goalCents !== undefined ? overrides.goalCents : 5000000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/founder/profile')) {
        return {
          ok: overrides?.profileOk !== false,
          json: async () => ({
            success: overrides?.profileOk !== false,
            data: overrides?.profileOk !== false ? profileData : undefined,
            message: overrides?.profileOk !== false ? undefined : 'Forbidden',
          }),
        };
      }
      if (url.includes('/api/founder/dashboard/goal')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { funding_goal_cents: goalCents },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, data: {} }) };
    });
  }

  it('renders navigation with required links', async () => {
    mockFetch();
    render(<FounderDashboardNewPage />);

    await waitFor(() => {
      expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    });

    const nav = screen.getByRole('navigation', { name: 'Founder Dashboard Navigation' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Profile' })).toHaveAttribute('href', '/founder/profile');
    expect(screen.getByRole('link', { name: 'Sponsorship Tiers' })).toHaveAttribute('href', '/founder/dashboard/tiers');
    expect(screen.getByRole('link', { name: 'Donors' })).toHaveAttribute('href', '/founder/dashboard/donors');
  });

  it('displays founder profile summary', async () => {
    mockFetch();
    render(<FounderDashboardNewPage />);

    await waitFor(() => {
      expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    });

    expect(screen.getByText('TerraVolt Energy')).toBeInTheDocument();
    expect(screen.getByText('maya@example.com')).toBeInTheDocument();
    expect(screen.getByText('Clean energy for northern communities.')).toBeInTheDocument();

    const profileSection = screen.getByLabelText('Profile Summary');
    expect(profileSection).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Edit Profile/ })[0]).toHaveAttribute('href', '/founder/profile');
  });

  it('displays current funding goal and allows setting a new one', async () => {
    mockFetch({ goalCents: 5000000 });
    render(<FounderDashboardNewPage />);

    await waitFor(() => {
      // $50,000 from 5,000,000 cents
      expect(screen.getByText(/50,000/)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Target amount (CAD $)');
    expect(input).toBeInTheDocument();
    // pre-filled with 50000
    expect(input).toHaveValue(50000);

    // Mock PATCH response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patchFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { funding_goal_cents: 7500000 } }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = patchFetch;

    fireEvent.change(input, { target: { value: '75000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Goal' }));

    await waitFor(() => {
      expect(screen.getByText('Funding goal saved.')).toBeInTheDocument();
    });

    expect(patchFetch).toHaveBeenCalledWith(
      '/api/founder/dashboard/goal',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('shows prompt when no funding goal is set', async () => {
    mockFetch({ goalCents: null });
    render(<FounderDashboardNewPage />);

    await waitFor(() => {
      expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    });

    expect(screen.getByText('No funding goal set yet.')).toBeInTheDocument();
  });

  it('renders QR code canvas and download button', async () => {
    mockFetch();
    render(<FounderDashboardNewPage />);

    await waitFor(() => {
      expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    });

    const qrSection = screen.getByLabelText('QR Code');
    expect(qrSection).toBeInTheDocument();

    // Canvas element should be present
    expect(screen.getByLabelText('Founder public profile QR code')).toBeInTheDocument();

    // Download button
    expect(screen.getByRole('button', { name: 'Download QR Code' })).toBeInTheDocument();
  });

  it('shows alert when profile fails to load', async () => {
    mockFetch({ profileOk: false });
    render(<FounderDashboardNewPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Forbidden');
    });
  });
});
