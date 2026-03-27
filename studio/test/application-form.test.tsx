import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApplicationForm } from '../src/components/public/ApplicationForm';

describe('ApplicationForm', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('shows pitch summary validation on blur', async () => {
    render(<ApplicationForm />);

    const pitchSummary = screen.getByLabelText(/Pitch summary \(100-1000 chars\)/i);
    fireEvent.change(pitchSummary, { target: { value: 'Too short' } });
    fireEvent.blur(pitchSummary);

    expect(await screen.findByText('Pitch summary must be 100 to 1000 characters')).toBeInTheDocument();
  });

  it('submits valid data and shows success message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Application submitted' }),
    } as Response);

    render(<ApplicationForm />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme Inc' } });
    fireEvent.change(screen.getByLabelText(/Pitch summary \(100-1000 chars\)/i), { target: { value: 'A'.repeat(120) } });
    fireEvent.change(screen.getByLabelText('Industry'), { target: { value: 'Fintech' } });
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Seed' } });
    fireEvent.change(screen.getByLabelText(/Pitch deck \(PDF, max 50MB\)/i), {
      target: { files: [new File(['pdf'], 'deck.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/public/apply', expect.objectContaining({ method: 'POST' }));
    });

    expect(await screen.findByText("Application received. We'll review and contact you within 5 business days.")).toBeInTheDocument();
  });
});
