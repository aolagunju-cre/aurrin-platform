import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValidationForm } from '../src/components/public/ValidationForm';

describe('ValidationForm', () => {
  const originalFetch = global.fetch;

  const baseProps = {
    eventId: 'event-1',
    sessionId: 'session-1',
    founderPitches: [{ id: 'pitch-1', company_name: 'Alpha Labs' }],
    questions: [
      { id: 'q1', type: 'rating' as const, prompt: 'Product-market fit' },
      { id: 'q2', type: 'yes_no' as const, prompt: 'Would you invest?' },
      { id: 'q3', type: 'text' as const, prompt: 'Additional comments' },
    ],
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function answerAllQuestions(): void {
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Strong team and traction.' } });
  }

  it('submits responses and shows success text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'Feedback submitted.' }),
    } as Response);

    render(<ValidationForm {...baseProps} />);

    answerAllQuestions();
    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/validate/event-1/session/session-1/response',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body).toEqual({
      founder_pitch_id: 'pitch-1',
      responses: {
        q1: '5',
        q2: 'yes',
        q3: 'Strong team and traction.',
      },
    });

    expect(await screen.findByText('Thanks for your feedback!')).toBeInTheDocument();
  });

  it('shows duplicate, rate-limit, and expired inline errors', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ success: false, message: "You've already submitted feedback for this founder" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ success: false }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ success: false, message: 'Forbidden' }),
      } as Response);

    global.fetch = mockFetch;

    render(<ValidationForm {...baseProps} />);

    answerAllQuestions();
    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    expect(await screen.findByText("You've already submitted feedback for this founder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    expect(await screen.findByText('Too many requests. Please wait and try again.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    expect(await screen.findByText('This validation session has expired. Please start again.')).toBeInTheDocument();
  });
});
