import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FounderReportsPage from '../src/app/(protected)/founder/reports/page';

describe('founder reports page', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders required status labels from report list', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            report_id: 'job-1',
            event_id: 'event-1',
            event_name: 'Demo Day',
            pitch_id: 'pitch-1',
            report_type: 'full',
            status: 'generating',
            created_at: '2026-03-27T00:00:00.000Z',
            download_url: null,
          },
          {
            report_id: 'job-2',
            event_id: 'event-1',
            event_name: 'Demo Day',
            pitch_id: 'pitch-1',
            report_type: 'summary',
            status: 'ready',
            created_at: '2026-03-27T00:10:00.000Z',
            download_url: '/api/founder/reports/job-2/download',
          },
          {
            report_id: 'job-3',
            event_id: 'event-2',
            event_name: 'Founder Finals',
            pitch_id: 'pitch-9',
            report_type: 'full',
            status: 'failed',
            created_at: '2026-03-27T00:20:00.000Z',
            download_url: null,
          },
        ],
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<FounderReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    expect(screen.getByText('Ready (download)')).toBeInTheDocument();
    expect(screen.getByText('Failed (try again)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/founder/reports/job-2/download'
    );
  });

  it('submits report request and shows exact async message', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            job_id: 'job-4',
            status_url: '/api/founder/reports/job-4/status',
          },
          message: "Your report is being generated. You'll receive an email when ready.",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              report_id: 'job-4',
              event_id: 'event-1',
              event_name: 'Demo Day',
              pitch_id: 'pitch-1',
              report_type: 'full',
              status: 'generating',
              created_at: '2026-03-27T00:30:00.000Z',
              download_url: null,
            },
          ],
        }),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    render(<FounderReportsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate New Report' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Event ID'), { target: { value: 'event-1' } });
    fireEvent.change(screen.getByLabelText('Pitch ID'), { target: { value: 'pitch-1' } });
    fireEvent.change(screen.getByLabelText('Report Type'), { target: { value: 'full' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate New Report' }));

    await waitFor(() => {
      expect(
        screen.getByText("Your report is being generated. You'll receive an email when ready.")
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/founder/reports/generate',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
