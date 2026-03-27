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
    <section aria-label="Validation Summary" style={{ border: '1px solid #e3e3e3', padding: '0.75rem' }}>
      <h2 style={{ marginTop: 0 }}>Validation Summary</h2>
      <p>{totalResponses} audience members provided feedback</p>
      <p>Aggregate audience score: {aggregateScore ?? 'N/A'}</p>

      {byQuestion.length > 0 ? (
        <ul>
          {byQuestion.map((question) => (
            <li key={question.question_id}>
              <p style={{ margin: '0 0 0.25rem 0' }}><strong>{question.question_id}</strong></p>
              <p style={{ margin: '0 0 0.25rem 0' }}>
                Response count: {question.response_count}; Average: {question.numeric_average ?? 'N/A'}
              </p>
              <p style={{ margin: '0 0 0.25rem 0' }}>
                {Object.entries(question.percentages)
                  .map(([option, pct]) => `${option} ${pct}%`)
                  .join(', ') || 'No percentage breakdown available'}
              </p>
              {question.text_summary.length > 0 ? (
                <p style={{ margin: 0 }}>Feedback: {question.text_summary.join(' | ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No validation responses available yet.</p>
      )}
    </section>
  );
}
