import React from 'react';

interface JudgeScore {
  judge_id: string;
  judge_name: string | null;
  total_score: number | null;
  category_scores: Record<string, number> | null;
  comments: string | null;
}

interface ScoreBreakdownCardProps {
  statusText: 'Judges are scoring' | string;
  aggregateScore: number | null;
  categoryBreakdown: Record<string, number> | null;
  perJudgeScores: JudgeScore[];
}

export default function ScoreBreakdownCard({
  statusText,
  aggregateScore,
  categoryBreakdown,
  perJudgeScores,
}: ScoreBreakdownCardProps): React.ReactElement {
  return (
    <section aria-label="Score Breakdown Card" style={{ border: '1px solid #e3e3e3', padding: '0.75rem' }}>
      <h2 style={{ marginTop: 0 }}>Score Breakdown</h2>
      <p style={{ margin: '0 0 0.5rem 0' }}>{statusText}</p>
      <p style={{ margin: '0 0 0.5rem 0' }}>Aggregate score: {aggregateScore ?? 'N/A'}</p>

      <div>
        <h3 style={{ marginBottom: '0.25rem' }}>Category Breakdown</h3>
        {categoryBreakdown && Object.keys(categoryBreakdown).length > 0 ? (
          <ul>
            {Object.entries(categoryBreakdown).map(([key, value]) => (
              <li key={key}>{key}: {value}</li>
            ))}
          </ul>
        ) : (
          <p>No category score breakdown is available yet.</p>
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: '0.25rem' }}>Per-Judge Scores</h3>
        {perJudgeScores.length > 0 ? (
          <ul>
            {perJudgeScores.map((judge) => (
              <li key={judge.judge_id}>
                {judge.judge_name ?? 'Anonymous Judge'}: {judge.total_score ?? 'N/A'}
                {judge.comments ? ` - ${judge.comments}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>No judge scores available yet.</p>
        )}
      </div>
    </section>
  );
}
