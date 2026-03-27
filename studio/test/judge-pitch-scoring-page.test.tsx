import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import JudgePitchScoringPage from '../src/app/(protected)/judge/events/[eventId]/pitch/[pitchId]/page';

describe('JudgePitchScoringPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders pitch scoring with comments and revision timeline', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/judge/pitches/pitch-1') && method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              pitch: {
                id: 'pitch-1',
                event_id: 'event-1',
                founder: {
                  company_name: 'Aurrin Labs',
                  user: {
                    name: 'Ada Founder',
                    email: 'ada@example.com',
                  },
                },
              },
              rubric: {
                id: 'rubric-v1',
                definition: {
                  categories: [
                    {
                      name: 'Execution',
                      weight: 100,
                      questions: [
                        { id: 'q1', text: 'Execution score', response_type: 'numeric', required: true },
                      ],
                    },
                  ],
                },
              },
            },
          }),
        };
      }

      if (url.endsWith('/api/judge/pitches/pitch-1/score') && method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              score_id: 'score-1',
              total_score: 87,
              breakdown: { Execution: 87 },
              state: 'draft',
              responses: { q1: 87 },
              comments: 'Good pacing',
              created_at: '2026-03-26T00:00:00.000Z',
              submitted_at: null,
              locked_at: null,
              updated_at: '2026-03-26T00:05:00.000Z',
            },
          }),
        };
      }

      if (url.endsWith('/api/judge/pitches/pitch-1/score') && method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }

      return {
        ok: false,
        json: async () => ({ success: false, message: 'Unhandled request' }),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<JudgePitchScoringPage params={Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-1' })} />);

    await waitFor(() => {
      expect(screen.getByText('Pitch Scoring')).toBeInTheDocument();
      expect(screen.getByLabelText('Global Comments')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Good pacing')).toBeInTheDocument();
    expect(screen.getByText('Revision History')).toBeInTheDocument();
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    expect(screen.getByText(/Last Draft:/)).toBeInTheDocument();
    expect(screen.getByText('Current Score Summary')).toBeInTheDocument();
  });

  it('surfaces optimistic conflict message and reloads', async () => {
    let scoreResponseCount = 0;

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/judge/pitches/pitch-2') && method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              pitch: { id: 'pitch-2', event_id: 'event-1', founder: null },
              rubric: {
                id: 'rubric-v1',
                definition: {
                  categories: [
                    {
                      name: 'Execution',
                      weight: 100,
                      questions: [
                        { id: 'q1', text: 'Execution score', response_type: 'numeric', required: true },
                      ],
                    },
                  ],
                },
              },
            },
          }),
        };
      }

      if (url.endsWith('/api/judge/pitches/pitch-2/score') && method === 'GET') {
        scoreResponseCount += 1;
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              score_id: 'score-2',
              total_score: 70,
              breakdown: { Execution: 70 },
              state: 'draft',
              responses: { q1: 70 },
              comments: 'Initial',
              created_at: '2026-03-26T00:00:00.000Z',
              submitted_at: null,
              locked_at: null,
              updated_at: `2026-03-26T00:0${scoreResponseCount}:00.000Z`,
            },
          }),
        };
      }

      if (url.endsWith('/api/judge/pitches/pitch-2/score') && method === 'POST') {
        return {
          ok: false,
          status: 409,
          json: async () => ({ success: false, message: 'This score was updated elsewhere' }),
        };
      }

      return {
        ok: false,
        json: async () => ({ success: false, message: 'Unhandled request' }),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<JudgePitchScoringPage params={Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-2' })} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Execution score')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Execution score'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(screen.getByText('This score was updated elsewhere')).toBeInTheDocument();
    });
    expect(scoreResponseCount).toBeGreaterThan(1);
  });

  it('prevents editing when score is submitted', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/judge/pitches/pitch-3') && method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              pitch: { id: 'pitch-3', event_id: 'event-1', founder: null },
              rubric: {
                id: 'rubric-v1',
                definition: {
                  categories: [
                    {
                      name: 'Execution',
                      weight: 100,
                      questions: [
                        { id: 'q1', text: 'Execution score', response_type: 'numeric', required: true },
                      ],
                    },
                  ],
                },
              },
            },
          }),
        };
      }

      if (url.endsWith('/api/judge/pitches/pitch-3/score') && method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              score_id: 'score-3',
              total_score: 95,
              breakdown: { Execution: 95 },
              state: 'submitted',
              responses: { q1: 95 },
              comments: 'Final comment',
              created_at: '2026-03-26T00:00:00.000Z',
              submitted_at: '2026-03-26T00:30:00.000Z',
              locked_at: null,
              updated_at: '2026-03-26T00:30:00.000Z',
            },
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ success: false, message: 'Unhandled request' }),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<JudgePitchScoringPage params={Promise.resolve({ eventId: 'event-1', pitchId: 'pitch-3' })} />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('This score is submitted and can no longer be edited.');
    });

    expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Score' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Global Comments')).toBeDisabled();
  });
});
