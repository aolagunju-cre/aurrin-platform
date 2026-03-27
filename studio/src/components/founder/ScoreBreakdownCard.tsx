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
    <section
      aria-label="Score Breakdown Card"
      className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10"
    >
      <h2 className="mt-0 text-lg font-semibold text-foreground">Score Breakdown</h2>
      <p className="mb-2 text-default-600">{statusText}</p>
      <p className="mb-2 text-default-600">
        Aggregate score:{' '}
        <span className="text-2xl font-bold text-violet-400">
          {aggregateScore ?? 'N/A'}
        </span>
      </p>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Category Breakdown</h3>
        {categoryBreakdown && Object.keys(categoryBreakdown).length > 0 ? (
          <ul className="space-y-1 list-none pl-0">
            {Object.entries(categoryBreakdown).map(([key, value]) => (
              <li key={key} className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-1.5 text-sm">
                <span className="text-default-600">{key}</span>
                <span className="font-semibold text-violet-400">{value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-default-400">No category score breakdown is available yet.</p>
        )}
      </div>

      <div className="mt-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Per-Judge Scores</h3>
        {perJudgeScores.length > 0 ? (
          <ul className="space-y-1 list-none pl-0">
            {perJudgeScores.map((judge) => (
              <li key={judge.judge_id} className="rounded-lg bg-default-100 px-3 py-1.5 text-sm text-default-600">
                <span className="font-medium text-foreground">{judge.judge_name ?? 'Anonymous Judge'}</span>
                :{' '}
                <span className="font-semibold text-violet-400">{judge.total_score ?? 'N/A'}</span>
                {judge.comments ? (
                  <span className="text-default-400"> - {judge.comments}</span>
                ) : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-default-400">No judge scores available yet.</p>
        )}
      </div>
    </section>
  );
}
