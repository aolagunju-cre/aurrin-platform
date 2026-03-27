import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FounderEventsPage from '../src/app/(protected)/founder/events/page';
import PublicFounderPage from '../src/app/public/founders/[founderId]/page';
import { getSupabaseClient } from '../src/lib/db/client';

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('founder archive and share profile contracts', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedGetSupabaseClient.mockReset();
  });

  it('renders historical archived pitches in a dedicated archive section', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'event-active',
            name: 'Current Event',
            status: 'live',
            start_date: '2026-04-20T10:00:00.000Z',
            end_date: '2026-04-20T13:00:00.000Z',
            scoring_start: '2026-04-20T09:30:00.000Z',
            scoring_end: '2026-04-20T12:30:00.000Z',
            publishing_start: '2026-04-21T00:00:00.000Z',
            publishing_end: '2026-04-22T00:00:00.000Z',
            scoring_window_open: true,
            assigned_judges: ['judge-1'],
            pitch: {
              id: 'pitch-active',
              pitch_deck_url: 'https://example.com/deck.pdf',
              score_aggregate: null,
              score_breakdown: null,
              score_progress: { submitted: 1, total: 1 },
            },
            scores_published: false,
          },
          {
            id: 'event-archive',
            name: 'Archived Demo Day',
            status: 'archived',
            start_date: '2026-01-10T10:00:00.000Z',
            end_date: '2026-01-10T13:00:00.000Z',
            scoring_start: '2026-01-10T09:30:00.000Z',
            scoring_end: '2026-01-10T12:30:00.000Z',
            publishing_start: '2026-01-11T00:00:00.000Z',
            publishing_end: '2026-01-12T00:00:00.000Z',
            scoring_window_open: false,
            assigned_judges: ['judge-2'],
            pitch: {
              id: 'pitch-archive',
              pitch_deck_url: 'https://example.com/deck-old.pdf',
              score_aggregate: 91,
              score_breakdown: { Team: 92 },
              score_progress: { submitted: 1, total: 1 },
            },
            scores_published: true,
          },
        ],
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<FounderEventsPage />);

    await waitFor(() => {
    expect(screen.getByLabelText('Founder Archive Table')).toBeInTheDocument();
    });

    expect(screen.getByText('Archived Demo Day')).toBeInTheDocument();
    expect(screen.getByText('Summary available')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View Pitch Detail' }).length).toBeGreaterThan(0);
  });

  it('renders a public share view without private founder fields', async () => {
    const mockDb = {
      queryTable: jest.fn()
        .mockResolvedValueOnce({
          data: [
            {
              id: 'founder-1',
              company_name: 'Orbit Labs',
              tagline: 'Funding climate tools',
              bio: 'We build carbon measurement software.',
              website: 'https://orbit.example',
              user: { name: 'Sam Founder' },
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'pitch-1',
              score_aggregate: 89.5,
              score_breakdown: { Market: 90, Team: 89 },
              is_published: true,
              published_at: '2026-03-01T00:00:00.000Z',
              event: {
                id: 'event-1',
                name: 'Spring Demo Day',
                publishing_start: '2026-03-01T00:00:00.000Z',
              },
            },
          ],
          error: null,
        }),
    };

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: mockDb as never,
    });

    const view = await PublicFounderPage({
      params: Promise.resolve({ founderId: 'founder-1' }),
    });
    render(view as React.ReactElement);

    expect(screen.getByRole('heading', { name: 'Orbit Labs' })).toBeInTheDocument();
    expect(screen.getByText('Spring Demo Day')).toBeInTheDocument();
    expect(screen.getByText('Aggregate score: 89.5')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pitch_deck_url/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/comments/i)).not.toBeInTheDocument();
  });
});
