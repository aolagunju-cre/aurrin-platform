import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScoringForm } from '../src/components/judge/ScoringForm';

describe('ScoringForm', () => {
  const rubricVersion = {
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
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows validation feedback and blocks submit when required fields are missing', () => {
    render(
      <ScoringForm
        rubricVersion={rubricVersion}
        onSubmitScore={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit Score' }));

    expect(screen.getByRole('alert')).toHaveTextContent('This field is required before submit.');
    expect(screen.queryByRole('dialog', { name: 'Submit Score confirmation' })).not.toBeInTheDocument();
  });

  it('opens confirmation modal and submits once confirmed', async () => {
    const onSubmitScore = jest.fn().mockResolvedValue(undefined);

    render(
      <ScoringForm
        rubricVersion={rubricVersion}
        onSubmitScore={onSubmitScore}
      />
    );

    fireEvent.change(screen.getByLabelText('Execution score'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Score' }));

    expect(screen.getByRole('dialog', { name: 'Submit Score confirmation' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Submit Score' }));

    await waitFor(() => {
      expect(onSubmitScore).toHaveBeenCalled();
    });
  });

  it('auto-saves drafts every 30 seconds', async () => {
    jest.useFakeTimers();
    const onAutoSaveDraft = jest.fn().mockResolvedValue(undefined);

    render(
      <ScoringForm
        rubricVersion={rubricVersion}
        onAutoSaveDraft={onAutoSaveDraft}
        onSubmitScore={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Execution score'), { target: { value: '77' } });

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(onAutoSaveDraft).toHaveBeenCalled();
    });
  });
});
