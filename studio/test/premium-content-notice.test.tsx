import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PremiumContentNotice } from '../src/components/content/PremiumContentNotice';

describe('PremiumContentNotice', () => {
  it('renders required premium content copy exactly', () => {
    render(<PremiumContentNotice />);
    expect(screen.getByText('Premium Content')).toBeInTheDocument();
    expect(screen.getByText('Subscribe to access')).toBeInTheDocument();
  });
});
