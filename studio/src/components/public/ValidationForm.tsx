'use client';

import { useMemo, useState } from 'react';
import { Button } from '@heroui/button';

export type ValidationQuestionType = 'rating' | 'yes_no' | 'text';

export interface ValidationQuestion {
  id: string;
  prompt: string;
  type: ValidationQuestionType;
}

export interface ValidationFounderPitch {
  id: string;
  company_name: string | null;
}

interface ValidationFormProps {
  eventId: string;
  sessionId: string;
  questions: ValidationQuestion[];
  founderPitches: ValidationFounderPitch[];
}

interface SubmitState {
  isSubmitting: boolean;
  success: boolean;
  error: string;
}

interface SubmitResponse {
  success?: boolean;
  message?: string;
}

type AnswerMap = Record<string, string>;

const SUCCESS_MESSAGE = 'Thanks for your feedback!';

function getErrorMessage(status: number, message?: string): string {
  if (status === 409) {
    return message || "You've already submitted feedback for this founder";
  }

  if (status === 403) {
    return 'This validation session has expired. Please start again.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait and try again.';
  }

  return message || 'Unable to submit feedback right now.';
}

export function ValidationForm({ eventId, sessionId, questions, founderPitches }: ValidationFormProps) {
  const [answersByPitch, setAnswersByPitch] = useState<Record<string, AnswerMap>>({});
  const [submitStateByPitch, setSubmitStateByPitch] = useState<Record<string, SubmitState>>({});

  const sortedPitches = useMemo(
    () => [...founderPitches].sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '')),
    [founderPitches]
  );

  const setAnswer = (pitchId: string, questionId: string, value: string) => {
    setAnswersByPitch((previous) => ({
      ...previous,
      [pitchId]: {
        ...(previous[pitchId] || {}),
        [questionId]: value,
      },
    }));
  };

  const submitPitch = async (pitchId: string) => {
    const pitchAnswers = answersByPitch[pitchId] || {};
    const responses = Object.fromEntries(
      Object.entries(pitchAnswers).filter(([, value]) => value.trim() !== '')
    );

    if (Object.keys(responses).length === 0) {
      setSubmitStateByPitch((previous) => ({
        ...previous,
        [pitchId]: { isSubmitting: false, success: false, error: 'Please answer at least one question before submitting.' },
      }));
      return;
    }

    setSubmitStateByPitch((previous) => ({
      ...previous,
      [pitchId]: { isSubmitting: true, success: false, error: '' },
    }));

    try {
      const response = await fetch(`/api/public/validate/${eventId}/session/${sessionId}/response`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ founder_pitch_id: pitchId, responses }),
      });

      const payload = await response.json() as SubmitResponse;
      if (!response.ok || payload.success !== true) {
        setSubmitStateByPitch((previous) => ({
          ...previous,
          [pitchId]: {
            isSubmitting: false,
            success: false,
            error: getErrorMessage(response.status, payload.message),
          },
        }));
        return;
      }

      setSubmitStateByPitch((previous) => ({
        ...previous,
        [pitchId]: { isSubmitting: false, success: true, error: '' },
      }));
    } catch {
      setSubmitStateByPitch((previous) => ({
        ...previous,
        [pitchId]: { isSubmitting: false, success: false, error: 'Unable to submit feedback right now.' },
      }));
    }
  };

  return (
    <section className="grid gap-6">
      {sortedPitches.map((pitch) => {
        const pitchState = submitStateByPitch[pitch.id] || { isSubmitting: false, success: false, error: '' };
        const pitchAnswers = answersByPitch[pitch.id] || {};

        return (
          <article
            key={pitch.id}
            className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10"
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {pitch.company_name || 'Founder Pitch'}
            </h2>

            <div className="grid gap-5">
              {questions.map((question) => (
                <fieldset key={question.id} className="border-0 p-0 m-0">
                  <legend className="font-semibold text-foreground mb-2">{question.prompt}</legend>

                  {question.type === 'rating' ? (
                    <div className="flex gap-3 flex-wrap mt-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label
                          key={value}
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border cursor-pointer transition-all duration-200 text-sm font-medium ${
                            pitchAnswers[question.id] === String(value)
                              ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                              : 'border-default-200 dark:border-gray-700 bg-default-100 text-default-600 hover:border-violet-500/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`${pitch.id}-${question.id}`}
                            value={value}
                            checked={pitchAnswers[question.id] === String(value)}
                            onChange={(event) => setAnswer(pitch.id, question.id, event.target.value)}
                            className="sr-only"
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {question.type === 'yes_no' ? (
                    <div className="flex gap-3 mt-1">
                      {['yes', 'no'].map((value) => (
                        <label
                          key={value}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all duration-200 text-sm font-medium ${
                            pitchAnswers[question.id] === value
                              ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                              : 'border-default-200 dark:border-gray-700 bg-default-100 text-default-600 hover:border-violet-500/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`${pitch.id}-${question.id}`}
                            value={value}
                            checked={pitchAnswers[question.id] === value}
                            onChange={(event) => setAnswer(pitch.id, question.id, event.target.value)}
                            className="sr-only"
                          />
                          {value === 'yes' ? 'Yes' : 'No'}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {question.type === 'text' ? (
                    <textarea
                      name={`${pitch.id}-${question.id}`}
                      value={pitchAnswers[question.id] || ''}
                      onChange={(event) => setAnswer(pitch.id, question.id, event.target.value)}
                      rows={4}
                      className="w-full mt-1 rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y"
                    />
                  ) : null}
                </fieldset>
              ))}
            </div>

            <div className="mt-5">
              <Button
                type="button"
                color="primary"
                isDisabled={pitchState.isSubmitting}
                isLoading={pitchState.isSubmitting}
                onPress={() => void submitPitch(pitch.id)}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {pitchState.isSubmitting ? 'Submitting...' : 'Submit feedback'}
              </Button>
            </div>

            {pitchState.success ? (
              <p role="status" className="mt-3 text-green-400 text-sm font-medium">{SUCCESS_MESSAGE}</p>
            ) : null}
            {pitchState.error ? (
              <p role="alert" className="mt-3 text-danger text-sm">{pitchState.error}</p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
