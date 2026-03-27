import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidateEntryPage from '../src/app/public/validate/[eventId]/page';
import { getSupabaseClient } from '../src/lib/db/client';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('../src/lib/db/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('Public validate entry page', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    pushMock.mockReset();

    mockedGetSupabaseClient.mockReturnValue({
      storage: {
        upload: jest.fn(),
        remove: jest.fn(),
        createSignedUrl: jest.fn(),
      },
      db: {
        getEventById: jest.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Aurrin Validation Night',
            start_date: '2026-04-11T10:00:00.000Z',
            end_date: '2026-04-11T16:00:00.000Z',
          },
          error: null,
        }),
      } as never,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders event details and starts validation session from Start Validation action', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: 'session-123' }),
    } as Response);

    const component = await ValidateEntryPage({ params: Promise.resolve({ eventId: 'event-1' }) });
    render(component);

    expect(screen.getByRole('heading', { name: 'Aurrin Validation Night' })).toBeInTheDocument();
    expect(screen.getByText(/Event date:/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email (optional)'), { target: { value: 'guest@example.com' } });
    fireEvent.click(screen.getByLabelText('Keep me updated about future events.'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Validation' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/validate/event-1/session',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const requestBody = JSON.parse(fetchCalls[0][1].body as string);
    expect(requestBody).toEqual(expect.objectContaining({
      email: 'guest@example.com',
      contact_opt_in: true,
      consent_given: true,
    }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/public/validate/event-1/session/session-123');
    });
  });
});
