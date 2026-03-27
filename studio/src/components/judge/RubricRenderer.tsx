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
    <section aria-label="Rubric Renderer" className="grid gap-4">
      {categories.map((category, categoryIndex) => (
        <fieldset
          key={`${category.name}-${categoryIndex}`}
          className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-5"
        >
          <legend className="px-2 text-sm font-semibold text-foreground">
            {category.name}{' '}
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400">
              {category.weight}%
            </span>
          </legend>
          <div className="grid gap-4 mt-2">
            {category.questions.map((question, questionIndex) => {
              const questionId = resolveQuestionId(question, categoryIndex, questionIndex);
              const value = responses[questionId];
              const error = errors[questionId];

              return (
                <div key={questionId} className="grid gap-1.5">
                  <label htmlFor={questionId} className="text-sm font-medium text-default-600">
                    {question.text}
                    {question.required ? <span className="text-danger ml-0.5">*</span> : ''}
                  </label>

                  {question.description ? (
                    <p className="m-0 text-xs text-default-400">{question.description}</p>
                  ) : null}

                  {question.response_type === 'text' ? (
                    <textarea
                      id={questionId}
                      aria-label={question.text}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(event) => onResponseChange(questionId, event.target.value)}
                      disabled={disabled}
                      rows={4}
                      className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[100px] resize-y disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  ) : null}

                  {question.response_type === 'radio' ? (
                    <div role="radiogroup" aria-label={question.text} className="flex flex-wrap gap-3">
                      {(question.scale ?? [1, 2, 3, 4, 5]).map((entry) => {
                        const optionValue = String(entry);
                        return (
                          <label
                            key={`${questionId}-${optionValue}`}
                            className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={questionId}
                              value={optionValue}
                              checked={String(value ?? '') === optionValue}
                              onChange={() => onResponseChange(questionId, optionValue)}
                              disabled={disabled}
                              className="accent-violet-500"
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
                      className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p role="alert" className="text-danger text-sm m-0">
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
