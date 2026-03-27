import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import JudgeEventsPage from '../src/app/(protected)/judge/events/page';
import JudgeEventPitchesPage from '../src/app/(protected)/judge/events/[eventId]/page';

describe('Judge events pages', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders only live or recent assigned events with scoring navigation links', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-20T11:00:00.000Z').getTime());

    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'event-live',
            name: 'Live Showcase',
            status: 'live',
            start_date: '2026-04-20T10:00:00.000Z',
            end_date: '2026-04-20T12:00:00.000Z',
            scoring_start: '2026-04-20T10:05:00.000Z',
            scoring_end: '2026-04-20T12:30:00.000Z',
          },
          {
            id: 'event-recent',
            name: 'Recent Finals',
            status: 'archived',
            start_date: '2026-04-10T10:00:00.000Z',
            end_date: '2026-04-12T12:00:00.000Z',
            scoring_start: '2026-04-11T10:05:00.000Z',
            scoring_end: '2026-04-11T12:30:00.000Z',
          },
          {
            id: 'event-old',
            name: 'Old Event',
            status: 'archived',
            start_date: '2026-02-01T10:00:00.000Z',
            end_date: '2026-02-01T12:00:00.000Z',
            scoring_start: '2026-02-01T10:05:00.000Z',
            scoring_end: '2026-02-01T12:30:00.000Z',
          },
        ],
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<JudgeEventsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Judge Events Table')).toBeInTheDocument();
    });

    expect(screen.getByText('Live Showcase')).toBeInTheDocument();
    expect(screen.getByText('Recent Finals')).toBeInTheDocument();
    expect(screen.queryByText('Old Event')).not.toBeInTheDocument();

    const eventLinks = screen.getAllByRole('link', { name: 'View Founder Pitches' });
    expect(eventLinks[0]).toHaveAttribute('href', '/judge/events/event-live');
    expect(screen.getByText(/Scoring open until/)).toBeInTheDocument();
    expect(screen.getAllByText('Scoring closed').length).toBeGreaterThan(0);
  });

  it('renders assigned pitches for an event with score links', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        meta: {
          scoring_window_open: false,
          scoring_end: '2026-04-01T11:30:00.000Z',
        },
        data: [
          {
            id: 'pitch-1',
            event_id: 'event-1',
            founder_id: 'founder-1',
            pitch_order: 2,
            company_name: 'Aurrin Labs',
            founder_name: 'Ada Founder',
            founder_email: 'ada@example.com',
          },
        ],
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<JudgeEventPitchesPage params={Promise.resolve({ eventId: 'event-1' })} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Judge Event Pitches Table')).toBeInTheDocument();
    });

    expect(screen.getByText('Ada Founder')).toBeInTheDocument();
    expect(screen.getAllByText('Scoring closed').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Score Pitch' })).not.toBeInTheDocument();
  });
});
