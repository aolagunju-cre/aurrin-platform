import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicDirectoryProfilePage from '../src/app/public/directory/[founderSlug]/page';
import { DirectoryShareButton } from '../src/components/public/DirectoryShareButton';

describe('public directory profile page', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders public profile fields and exact CTA text without private score internals', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          founder_slug: 'orbit-labs',
          name: 'Sam Founder',
          company: 'Orbit Labs',
          industry: 'climate',
          stage: 'seed',
          summary: 'Long-form founder summary for public profile.',
          photo: null,
          score: 91,
          social_links: {
            website: 'https://orbit.example',
            linkedin: 'https://linkedin.com/company/orbit',
            twitter: 'https://twitter.com/orbit',
          },
          badges: ['Top Score', 'Audience Favorite'],
          deck_link: 'https://example.com/deck.pdf',
          event: {
            id: 'event-1',
            name: 'Spring Demo Day',
            starts_at: '2026-03-01T00:00:00.000Z',
            ends_at: '2026-03-02T00:00:00.000Z',
          },
        },
      }),
    });

    const page = await PublicDirectoryProfilePage({ params: Promise.resolve({ founderSlug: 'orbit-labs' }) });
    render(page as React.ReactElement);

    expect(screen.getByRole('heading', { name: 'Sam Founder' })).toBeInTheDocument();
    expect(screen.getByText('Orbit Labs')).toBeInTheDocument();
    expect(screen.getByText('Industry: climate')).toBeInTheDocument();
    expect(screen.getByText('Stage: seed')).toBeInTheDocument();
    expect(screen.getByText(/Spring Demo Day/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview Deck' })).toHaveAttribute('href', 'https://example.com/deck.pdf');
    expect(screen.getByRole('link', { name: 'linkedin.com' })).toHaveAttribute(
      'href',
      'https://linkedin.com/company/orbit'
    );
    expect(screen.getByText('Top Score')).toBeInTheDocument();
    expect(screen.getByText('Audience Favorite')).toBeInTheDocument();
    expect(screen.getByText('Interested? Contact {Aurrin}')).toBeInTheDocument();
    expect(screen.queryByText(/score_breakdown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/validation/i)).not.toBeInTheDocument();

    const callUrl = ((global as any).fetch as jest.Mock).mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/public/directory/orbit-labs');
  });

  it('copies profile URL when Share is clicked', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, 'share', {
      value: undefined,
      configurable: true,
    });

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<DirectoryShareButton profileUrl="https://example.com/public/directory/orbit-labs" />);

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://example.com/public/directory/orbit-labs');
    });

    await waitFor(() => {
      expect(screen.getByText('Profile URL copied.')).toBeInTheDocument();
    });
  });
});
