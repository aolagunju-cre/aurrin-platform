'use client';

import { useMemo, useState } from 'react';

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
    <section style={{ display: 'grid', gap: '1rem' }}>
      {sortedPitches.map((pitch) => {
        const pitchState = submitStateByPitch[pitch.id] || { isSubmitting: false, success: false, error: '' };
        const pitchAnswers = answersByPitch[pitch.id] || {};

        return (
          <article key={pitch.id} style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>{pitch.company_name || 'Founder Pitch'}</h2>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {questions.map((question) => (
                <fieldset key={question.id} style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontWeight: 600 }}>{question.prompt}</legend>

                  {question.type === 'rating' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`${pitch.id}-${question.id}`}
                            value={value}
                            checked={pitchAnswers[question.id] === String(value)}
                            onChange={(event) => setAnswer(pitch.id, question.id, event.target.value)}
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {question.type === 'yes_no' ? (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                      {['yes', 'no'].map((value) => (
                        <label key={value} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`${pitch.id}-${question.id}`}
                            value={value}
                            checked={pitchAnswers[question.id] === value}
                            onChange={(event) => setAnswer(pitch.id, question.id, event.target.value)}
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
                      style={{ width: '100%', marginTop: '0.25rem' }}
                    />
                  ) : null}
                </fieldset>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void submitPitch(pitch.id)}
              disabled={pitchState.isSubmitting}
              style={{ marginTop: '1rem' }}
            >
              {pitchState.isSubmitting ? 'Submitting...' : 'Submit feedback'}
            </button>

            {pitchState.success ? <p role="status" style={{ marginBottom: 0 }}>{SUCCESS_MESSAGE}</p> : null}
            {pitchState.error ? <p role="alert" style={{ marginBottom: 0, color: '#b00020' }}>{pitchState.error}</p> : null}
          </article>
        );
      })}
    </section>
  );
}
