import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicDirectoryPage from '../src/app/public/directory/page';

interface MockDirectoryItem {
  founder_slug: string;
  founder_name: string;
  company: string;
  industry: string;
  stage: string;
  summary: string;
  photo: string | null;
  score: number | null;
  event: {
    id: string;
    name: string;
  };
}

describe('public directory page', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders public directory cards and responsive grid layout', async () => {
    const items: MockDirectoryItem[] = [
      {
        founder_slug: 'orbit-labs',
        founder_name: 'Sam Founder',
        company: 'Orbit Labs',
        industry: 'climate',
        stage: 'seed',
        summary: 'Climate intelligence platform for industrial decarbonization.',
        photo: null,
        score: 89.5,
        event: { id: 'event-1', name: 'Spring Demo Day' },
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items }),
    });

    const page = PublicDirectoryPage();
    render(page as React.ReactElement);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sam Founder' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Aurrin Founder Directory' })).toBeInTheDocument();
    expect(screen.getByText('Orbit Labs')).toBeInTheDocument();
    expect(screen.getByText('Aggregate score: 89.5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute('href', '/public/directory/orbit-labs');
    expect(screen.getByTestId('directory-grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    });
  });

  it('applies search and filter controls against the public directory API', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              founder_slug: 'orbit-labs',
              founder_name: 'Sam Founder',
              company: 'Orbit Labs',
              industry: 'climate',
              stage: 'seed',
              summary: 'Climate software',
              photo: null,
              score: 89,
              event: { id: 'event-1', name: 'Spring Demo Day' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

    const page = PublicDirectoryPage();
    render(page as React.ReactElement);

    await waitFor(() => {
      expect(screen.getByText('Sam Founder')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Search by company or founder name'), { target: { value: 'orbit' } });
    fireEvent.change(screen.getByLabelText('Industry'), { target: { value: 'climate' } });
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'seed' } });
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'event-1' } });
    fireEvent.change(screen.getByLabelText('Min score'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Max score'), { target: { value: '95' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() => {
      expect(screen.getByText('No public founder profiles match your filters.')).toBeInTheDocument();
    });

    const secondCall = ((global as any).fetch as jest.Mock).mock.calls[1][0] as string;
    expect(secondCall).toContain('/api/public/directory?');
    expect(secondCall).toContain('search=orbit');
    expect(secondCall).toContain('industry=climate');
    expect(secondCall).toContain('stage=seed');
    expect(secondCall).toContain('event=event-1');
    expect(secondCall).toContain('minScore=70');
    expect(secondCall).toContain('maxScore=95');
  });
});
