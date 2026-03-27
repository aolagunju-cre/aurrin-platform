import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MentorDashboardPage from '../src/app/(protected)/mentor/page';
import MentorMatchDetailPage from '../src/app/(protected)/mentor/matches/[matchId]/page';

describe('mentor portal pages', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders mentor dashboard pending copy and sections', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          counts: { pending: 1, accepted: 1 },
          events: [{ id: 'event-1', name: 'Mentor Night', status: 'live', pending: 1, accepted: 1 }],
          matches: [
            {
              id: 'match-1',
              mentor_status: 'pending',
              founder: { id: 'founder-1', name: 'Founder One', company: 'Acme' },
              event: { id: 'event-1', name: 'Mentor Night' },
            },
            {
              id: 'match-2',
              mentor_status: 'accepted',
              founder: { id: 'founder-2', name: 'Founder Two', company: 'Beta' },
              event: { id: 'event-1', name: 'Mentor Night' },
            },
          ],
        },
      }),
    }));

    render(<MentorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("You've been matched with Founder One. Accept or decline?")).toBeInTheDocument();
    });

    expect(screen.getByText('Pending matches: 1')).toBeInTheDocument();
    expect(screen.getByText('Accepted matches: 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review match details' })).toHaveAttribute('href', '/mentor/matches/match-1');
  });

  it('renders mentor detail and submits accept action', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'match-1',
            mentor_status: 'pending',
            founder_status: 'pending',
            founder: {
              id: 'founder-1',
              name: 'Founder One',
              company: 'Acme',
              pitch_summary: 'Building a better workflow.',
              scores: {
                aggregate: 88,
                breakdown: { market: 44, traction: 44 },
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            status: 'accepted',
            mutual_acceptance: false,
          },
        }),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<MentorMatchDetailPage params={Promise.resolve({ matchId: 'match-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Founder name: Founder One')).toBeInTheDocument();
    });
    expect(screen.getByText('Pitch summary: Building a better workflow.')).toBeInTheDocument();
    expect(screen.getByText('market: 44')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/mentor/matches/match-1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });
});
