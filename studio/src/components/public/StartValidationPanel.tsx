'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StartValidationPanelProps {
  eventId: string;
}

interface SessionCreateResponse {
  session_id?: string;
  message?: string;
}

export function StartValidationPanel({ eventId }: StartValidationPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contactOptIn, setContactOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/public/validate/${eventId}/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || undefined,
          contact_opt_in: contactOptIn,
          consent_given: true,
        }),
      });

      const payload = await response.json() as SessionCreateResponse;
      if (!response.ok || !payload.session_id) {
        setSubmitError(payload.message ?? 'Unable to start validation right now.');
        return;
      }

      router.push(`/public/validate/${eventId}/session/${payload.session_id}`);
    } catch {
      setSubmitError('Unable to start validation right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
      <label htmlFor="validation-email">Email (optional)</label>
      <input
        id="validation-email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <label htmlFor="contact-opt-in" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          id="contact-opt-in"
          name="contact_opt_in"
          type="checkbox"
          checked={contactOptIn}
          onChange={(e) => setContactOptIn(e.target.checked)}
        />
        Keep me updated about future events.
      </label>

      <button type="submit" disabled={isSubmitting} style={{ maxWidth: 220 }}>
        {isSubmitting ? 'Starting...' : 'Start Validation'}
      </button>

      {submitError ? <p role="alert" style={{ margin: 0, color: '#b00020' }}>{submitError}</p> : null}
    </form>
  );
}
