import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import FounderDashboardPage from '../src/app/(protected)/founder/page';
import FounderProfilePage from '../src/app/(protected)/founder/profile/page';
import FounderPitchDetailPage from '../src/app/(protected)/founder/events/[eventId]/pitch/page';

describe('founder portal pages', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders founder dashboard navigation and quick stats', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/founder/events')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'event-1', status: 'live' },
              { id: 'event-2', status: 'archived' },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            matches: [
              {
                id: 'match-1',
                created_at: '2026-03-27T00:00:00.000Z',
                mentor: {
                  name: 'Mentor One',
                  title: null,
                  contact: { email: 'mentor1@example.com' },
                },
              },
            ],
          },
        }),
      };
    });

    render(<FounderDashboardPage />);

    const quickStats = screen.getByLabelText('Founder Quick Stats');
    const applicationsCard = screen.getByText('Applications submitted').closest('div');
    const activeEventsCard = screen.getByText('Active events').closest('div');
    const completedEventsCard = screen.getByText('Completed events').closest('div');
    const mentorMatchesCard = screen.getByText('Accepted mentor matches').closest('div');

    expect(applicationsCard).not.toBeNull();
    expect(activeEventsCard).not.toBeNull();
    expect(completedEventsCard).not.toBeNull();
    expect(mentorMatchesCard).not.toBeNull();

    await waitFor(() => {
      expect(within(applicationsCard as HTMLElement).getByText('2')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/founder/profile');
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/founder/events');
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/founder/reports');
    expect(within(quickStats).getByText('Applications submitted')).toBeInTheDocument();
    expect(within(applicationsCard as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(activeEventsCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(completedEventsCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(mentorMatchesCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/Mentor One/)).toBeInTheDocument();
  });

  it('renders profile page and submits profile updates', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            founder_id: 'founder-1',
            user_id: 'user-1',
            name: 'Founder One',
            email: 'founder@example.com',
            company_name: 'Acme',
            pitch_summary: 'Initial summary',
            deck_url: 'https://example.com/deck.pdf',
            contact_preferences: { product_updates: true, score_notifications: false },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            founder_id: 'founder-1',
            user_id: 'user-1',
            name: 'Founder One',
            email: 'founder@example.com',
            company_name: 'Acme Labs',
            pitch_summary: 'Initial summary',
            deck_url: 'https://example.com/deck.pdf',
            contact_preferences: { product_updates: true, score_notifications: false },
          },
        }),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<FounderProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Email: founder@example.com')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Acme Labs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(screen.getByText('Profile updated.')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/founder/profile', expect.objectContaining({ method: 'PATCH' }));
  });

  it('renders pitch detail with unpublished and published score states', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            event: {
              id: 'event-1',
              name: 'Founder Finals',
              publishing_start: '2026-04-22T00:00:00.000Z',
            },
            pitch: {
              id: 'pitch-1',
              founder_id: 'founder-1',
              pitch_deck_url: 'https://example.com/deck.pdf',
              scoring_status: 'scores_publish_pending',
              score_progress: { submitted: 1, total: 3 },
              score_aggregate: null,
              score_breakdown: null,
              scores_published: false,
            },
          },
        }),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<FounderPitchDetailPage params={Promise.resolve({ eventId: 'event-1' })} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Scores will be published on/).length).toBeGreaterThan(0);
    });

    expect(screen.getByRole('button', { name: 'Download Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share Profile' })).toBeInTheDocument();
  });

  it('shows role-protected access errors from founder APIs', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, message: 'Forbidden' }),
    }));

    render(<FounderPitchDetailPage params={Promise.resolve({ eventId: 'event-2' })} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Forbidden');
    });
  });
});
