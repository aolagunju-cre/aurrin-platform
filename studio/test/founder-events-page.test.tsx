import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FounderEventsPage from '../src/app/(protected)/founder/events/page';

describe('FounderEventsPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('shows publish-gated messaging and reveals scores after publishing starts', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-20T12:00:00.000Z').getTime());

    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'event-pre',
            name: 'Pre Publish Event',
            status: 'live',
            start_date: '2026-04-20T10:00:00.000Z',
            end_date: '2026-04-20T13:00:00.000Z',
            scoring_start: '2026-04-20T09:30:00.000Z',
            scoring_end: '2026-04-20T12:30:00.000Z',
            publishing_start: '2026-04-21T00:00:00.000Z',
            publishing_end: '2026-04-22T00:00:00.000Z',
            scoring_window_open: true,
            assigned_judges: ['judge-1', 'judge-2'],
            pitch: {
              id: 'pitch-1',
              pitch_deck_url: 'https://example.com/deck.pdf',
              score_aggregate: null,
              score_breakdown: null,
              score_progress: { submitted: 1, total: 2 },
            },
            scores_published: false,
          },
          {
            id: 'event-post',
            name: 'Published Event',
            status: 'archived',
            start_date: '2026-04-18T10:00:00.000Z',
            end_date: '2026-04-18T12:00:00.000Z',
            scoring_start: '2026-04-18T09:00:00.000Z',
            scoring_end: '2026-04-18T11:00:00.000Z',
            publishing_start: '2026-04-18T12:30:00.000Z',
            publishing_end: '2026-04-19T12:30:00.000Z',
            scoring_window_open: false,
            assigned_judges: ['judge-3'],
            pitch: {
              id: 'pitch-2',
              pitch_deck_url: 'https://example.com/deck-2.pdf',
              score_aggregate: 92.5,
              score_breakdown: { Execution: 93, Market: 92 },
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
      expect(screen.getByLabelText('Founder Events Table')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Judges are scoring').length).toBeGreaterThan(0);
    expect(screen.getByText(/Scores will be published on/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByLabelText('Founder Archive Table')).toBeInTheDocument();
    expect(screen.getByText('Published Event')).toBeInTheDocument();
    const detailLinks = screen.getAllByRole('link', { name: 'View Pitch Detail' });
    expect(detailLinks[0]).toHaveAttribute('href', '/founder/events/event-pre/pitch');
    expect(detailLinks[1]).toHaveAttribute('href', '/founder/events/event-post/pitch');
  });
});
