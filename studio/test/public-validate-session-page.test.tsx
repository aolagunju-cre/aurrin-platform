import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidateSessionPage from '../src/app/public/validate/[eventId]/session/[sessionId]/page';

describe('Public validate session page', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('loads session payload and renders rating, yes/no, and text questions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          event: {
            id: 'event-1',
            name: 'Validation Day',
            start_date: '2026-05-10T10:00:00.000Z',
            end_date: '2026-05-10T15:00:00.000Z',
          },
          founder_pitches: [
            { id: 'pitch-1', company_name: 'Alpha Labs' },
            { id: 'pitch-2', company_name: 'Beta Systems' },
          ],
          questions: [
            { id: 'q1', type: 'rating', prompt: 'Product-market fit' },
            { id: 'q2', type: 'yes_no', prompt: 'Would you invest?' },
            { id: 'q3', type: 'text', prompt: 'Additional comments' },
          ],
        },
      }),
    } as Response);

    render(<ValidateSessionPage params={Promise.resolve({ eventId: 'event-1', sessionId: 'session-1' })} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Validation Day' })).toBeInTheDocument();
    });

    expect(screen.getByText('Alpha Labs')).toBeInTheDocument();
    expect(screen.getByText('Beta Systems')).toBeInTheDocument();
    expect(screen.getAllByText('Product-market fit').length).toBe(2);
    expect(screen.getAllByText('Would you invest?').length).toBe(2);
    expect(screen.getAllByText('Additional comments').length).toBe(2);
    expect(screen.getAllByRole('button', { name: 'Submit feedback' }).length).toBe(2);
  });
});
