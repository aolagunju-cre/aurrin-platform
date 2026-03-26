'use client';

import React from 'react';
import type { ScoringResponses, ScoringRubricVersion, ScoringQuestion } from '../../lib/scoring/calculate';
import { resolveQuestionId } from '../../lib/scoring/calculate';

interface RubricRendererProps {
  rubricVersion: ScoringRubricVersion;
  responses: ScoringResponses;
  errors?: Record<string, string>;
  disabled?: boolean;
  onResponseChange: (questionId: string, value: unknown) => void;
}

function hasResponse(value: unknown): boolean {
  return !(value === undefined || value === null || value === '');
}

function renderSelectionOptions(question: ScoringQuestion): Array<{ label: string; value: string }> {
  if (question.options && question.options.length > 0) {
    return question.options.map((option) => ({
      label: option.label,
      value: String(option.value),
    }));
  }

  const fallbackScale = question.scale ?? [1, 2, 3, 4, 5];
  return fallbackScale.map((entry) => ({ label: String(entry), value: String(entry) }));
}

export function RubricRenderer({ rubricVersion, responses, errors = {}, disabled = false, onResponseChange }: RubricRendererProps): React.ReactElement {
  const categories = rubricVersion?.definition?.categories ?? [];

  return (
    <section aria-label="Rubric Renderer" style={{ display: 'grid', gap: '1rem' }}>
      {categories.map((category, categoryIndex) => (
        <fieldset key={`${category.name}-${categoryIndex}`} style={{ border: '1px solid #d0d0d0', padding: '0.75rem' }}>
          <legend>{category.name} ({category.weight}%)</legend>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {category.questions.map((question, questionIndex) => {
              const questionId = resolveQuestionId(question, categoryIndex, questionIndex);
              const value = responses[questionId];
              const error = errors[questionId];

              return (
                <div key={questionId} style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor={questionId} style={{ fontWeight: 600 }}>
                    {question.text}
                    {question.required ? ' *' : ''}
                  </label>

                  {question.description ? <p style={{ margin: 0 }}>{question.description}</p> : null}

                  {question.response_type === 'text' ? (
                    <textarea
                      id={questionId}
                      aria-label={question.text}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(event) => onResponseChange(questionId, event.target.value)}
                      disabled={disabled}
                      rows={4}
                    />
                  ) : null}

                  {question.response_type === 'numeric' ? (
                    <input
                      id={questionId}
                      aria-label={question.text}
                      type="number"
                      min={0}
                      max={100}
                      value={typeof value === 'number' || typeof value === 'string' ? value : ''}
                      onChange={(event) => onResponseChange(questionId, event.target.value)}
                      disabled={disabled}
                    />
                  ) : null}

                  {question.response_type === 'radio' ? (
                    <div role="radiogroup" aria-label={question.text}>
                      {(question.scale ?? [1, 2, 3, 4, 5]).map((entry) => {
                        const optionValue = String(entry);
                        return (
                          <label key={`${questionId}-${optionValue}`} style={{ marginRight: '0.75rem' }}>
                            <input
                              type="radio"
                              name={questionId}
                              value={optionValue}
                              checked={String(value ?? '') === optionValue}
                              onChange={() => onResponseChange(questionId, optionValue)}
                              disabled={disabled}
                            />
                            {optionValue}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}

                  {question.response_type === 'selection' ? (
                    <select
                      id={questionId}
                      aria-label={question.text}
                      value={hasResponse(value) ? String(value) : ''}
                      onChange={(event) => onResponseChange(questionId, event.target.value)}
                      disabled={disabled}
                    >
                      <option value="">Select an option</option>
                      {renderSelectionOptions(question).map((option) => (
                        <option key={`${questionId}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {error ? (
                    <p role="alert" style={{ color: '#b00020', margin: 0 }}>
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
