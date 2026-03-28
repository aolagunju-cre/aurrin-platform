import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventDetailPage from '../src/app/public/events/[id]/page';
import PortfolioPage from '../src/app/public/portfolio/page';
import { FeaturedCampaigns } from '../src/components/public/FeaturedCampaigns';

describe('public founder navigation', () => {
  it('links event founders to the DB-backed public directory profile', async () => {
    const page = await EventDetailPage({ params: Promise.resolve({ id: 'pitch-night-february-2026' }) });
    render(page as React.ReactElement);

    expect(screen.getByRole('link', { name: 'View Jeremy Hunter profile' })).toHaveAttribute(
      'href',
      '/public/directory/omneo-inc'
    );
  });

  it('links featured founder cards to public directory profiles', () => {
    render(<FeaturedCampaigns />);

    expect(
      screen.getByRole('link', { name: 'View Amirhossein Foroughi & Haden Harrison profile' })
    ).toHaveAttribute('href', '/public/directory/agrivanna');
  });

  it('links portfolio founder cards to public directory profiles', () => {
    render(<PortfolioPage />);

    expect(screen.getByRole('link', { name: 'View Jeremy Hunter profile' })).toHaveAttribute(
      'href',
      '/public/directory/omneo-inc'
    );
  });
});
