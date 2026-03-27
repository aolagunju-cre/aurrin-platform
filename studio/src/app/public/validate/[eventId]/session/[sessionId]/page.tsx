'use client';

import { useEffect, useMemo, useState } from 'react';
import { ValidationForm, ValidationFounderPitch, ValidationQuestion, ValidationQuestionType } from '../../../../../../components/public/ValidationForm';

interface ValidateSessionPageProps {
  params: Promise<{ eventId: string; sessionId: string }>;
}

interface SessionPayload {
  success: boolean;
  message?: string;
  data?: {
    event: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
    };
    founder_pitches: Array<{
      id: string;
      company_name: string | null;
    }>;
    questions: unknown[];
  };
}

interface EventDetails {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

function normalizeQuestions(rawQuestions: unknown[]): ValidationQuestion[] {
  return rawQuestions
    .map((rawQuestion) => {
      if (!rawQuestion || typeof rawQuestion !== 'object' || Array.isArray(rawQuestion)) {
        return null;
      }

      const typed = rawQuestion as Record<string, unknown>;
      const id = typeof typed.id === 'string' ? typed.id : null;
      const prompt =
        typeof typed.prompt === 'string' ? typed.prompt :
        typeof typed.label === 'string' ? typed.label :
        typeof typed.question === 'string' ? typed.question :
        null;

      const typeValue = typeof typed.type === 'string' ? typed.type.toLowerCase() : '';
      let type: ValidationQuestionType | null = null;
      if (typeValue === 'rating') {
        type = 'rating';
      } else if (typeValue === 'yes_no' || typeValue === 'yes-no' || typeValue === 'boolean') {
        type = 'yes_no';
      } else if (typeValue === 'text' || typeValue === 'feedback') {
        type = 'text';
      }

      if (!id || !prompt || !type) {
        return null;
      }

      return { id, prompt, type };
    })
    .filter((value): value is ValidationQuestion => value !== null);
}

function formatEventDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Date to be announced';
  }

  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

export default function ValidateSessionPage({ params }: ValidateSessionPageProps) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [founderPitches, setFounderPitches] = useState<ValidationFounderPitch[]>([]);
  const [questions, setQuestions] = useState<ValidationQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionData(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const resolved = await params;
        if (cancelled) {
          return;
        }

        setEventId(resolved.eventId);
        setSessionId(resolved.sessionId);

        const response = await fetch(`/api/public/validate/${resolved.eventId}/session/${resolved.sessionId}`);
        const payload = await response.json() as SessionPayload;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || 'Unable to load validation session.');
        }

        if (cancelled) {
          return;
        }

        setEventDetails(payload.data.event);
        setFounderPitches(payload.data.founder_pitches || []);
        setQuestions(normalizeQuestions(payload.data.questions || []));
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load validation session.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSessionData();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const hasRenderableQuestions = useMemo(() => questions.length > 0, [questions]);

  if (isLoading) {
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        <p>Loading validation session...</p>
      </main>
    );
  }

  if (error || !eventDetails || !eventId || !sessionId) {
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        <p role="alert">{error || 'Unable to load validation session.'}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem', display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>{eventDetails.name}</h1>
      <p style={{ margin: 0 }}>
        Event date: {formatEventDateRange(eventDetails.start_date, eventDetails.end_date)}
      </p>

      {!hasRenderableQuestions ? (
        <p role="alert">No validation questions are currently configured for this event.</p>
      ) : null}

      {founderPitches.length === 0 ? (
        <p role="alert">No founder pitches are available for this event yet.</p>
      ) : null}

      {hasRenderableQuestions && founderPitches.length > 0 ? (
        <ValidationForm
          eventId={eventId}
          sessionId={sessionId}
          founderPitches={founderPitches}
          questions={questions}
        />
      ) : null}
    </main>
  );
}
