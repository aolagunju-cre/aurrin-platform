import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileForm from '../src/components/founder/ProfileForm';
import ScoreBreakdownCard from '../src/components/founder/ScoreBreakdownCard';
import ValidationSummary from '../src/components/founder/ValidationSummary';

describe('founder portal components', () => {
  it('submits profile updates through ProfileForm', async () => {
    const onSubmit = jest.fn(async () => undefined);

    render(
      <ProfileForm
        initialValues={{
          name: 'Founder One',
          company_name: 'Acme',
          pitch_summary: 'Summary',
          deck_url: 'https://example.com/deck.pdf',
          contact_preferences: {
            product_updates: false,
            score_notifications: true,
          },
        }}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Acme Labs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: 'Acme Labs',
          name: 'Founder One',
        })
      );
    });
  });

  it('renders score breakdown card with aggregate and per-judge scores', () => {
    render(
      <ScoreBreakdownCard
        statusText="Scores published"
        aggregateScore={88.4}
        categoryBreakdown={{ Team: 90, Market: 87 }}
        perJudgeScores={[
          {
            judge_id: 'judge-1',
            judge_name: 'Judge One',
            total_score: 89,
            category_scores: { Team: 90 },
            comments: 'Strong execution',
          },
        ]}
      />
    );

    expect(screen.getByText('Scores published')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Aggregate score: 88.4')).toBeInTheDocument();

    const teamRow = screen.getByText('Team').closest('li');
    const judgeRow = screen.getByText('Judge One').closest('li');

    expect(teamRow).not.toBeNull();
    expect(judgeRow).not.toBeNull();
    expect(within(teamRow as HTMLElement).getByText('90')).toBeInTheDocument();
    expect(judgeRow as HTMLElement).toHaveTextContent('Judge One: 89 - Strong execution');
  });

  it('renders validation summary with question percentages and text', () => {
    render(
      <ValidationSummary
        totalResponses={42}
        aggregateScore={4.2}
        byQuestion={[
          {
            question_id: 'Would you invest?',
            response_count: 42,
            numeric_average: null,
            percentages: { yes: 80, maybe: 20 },
            text_summary: ['Great team, needs more traction'],
          },
        ]}
      />
    );

    expect(screen.getByText((_, element) => element?.textContent === '42 audience members provided feedback')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Aggregate audience score: 4.2')).toBeInTheDocument();
    expect(screen.getByText('yes 80%, maybe 20%')).toBeInTheDocument();
    expect(screen.getByText(/Great team, needs more traction/)).toBeInTheDocument();
  });
});
