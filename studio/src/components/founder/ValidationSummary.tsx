import React from 'react';

interface ValidationQuestionSummary {
  question_id: string;
  response_count: number;
  numeric_average: number | null;
  percentages: Record<string, number>;
  text_summary: string[];
}

interface ValidationSummaryProps {
  totalResponses: number;
  aggregateScore: number | null;
  byQuestion: ValidationQuestionSummary[];
}

export default function ValidationSummary({
  totalResponses,
  aggregateScore,
  byQuestion,
}: ValidationSummaryProps): React.ReactElement {
  return (
    <section
      aria-label="Validation Summary"
      className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10"
    >
      <h2 className="mt-0 text-lg font-semibold text-foreground">Validation Summary</h2>
      <p className="text-default-600">
        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400">
          {totalResponses}
        </span>{' '}
        audience members provided feedback
      </p>
      <p className="text-default-600">
        Aggregate audience score:{' '}
        <span className="text-2xl font-bold text-violet-400">
          {aggregateScore ?? 'N/A'}
        </span>
      </p>

      {byQuestion.length > 0 ? (
        <ul className="space-y-3 list-none pl-0 mt-4">
          {byQuestion.map((question) => (
            <li
              key={question.question_id}
              className="rounded-xl border border-default-200 bg-default-100 p-4"
            >
              <p className="mb-1 text-sm font-semibold text-foreground">{question.question_id}</p>
              <p className="mb-1 text-sm text-default-600">
                Response count:{' '}
                <span className="font-medium text-foreground">{question.response_count}</span>;
                Average:{' '}
                <span className="font-semibold text-violet-400">{question.numeric_average ?? 'N/A'}</span>
              </p>
              <p className="mb-1 text-sm text-default-500">
                {Object.entries(question.percentages)
                  .map(([option, pct]) => `${option} ${pct}%`)
                  .join(', ') || 'No percentage breakdown available'}
              </p>
              {question.text_summary.length > 0 ? (
                <p className="m-0 text-sm text-default-400 italic">
                  Feedback: {question.text_summary.join(' | ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-default-400">No validation responses available yet.</p>
      )}
    </section>
  );
}
