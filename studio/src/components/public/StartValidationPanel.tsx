'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';

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
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6"
    >
      <Input
        id="validation-email"
        name="email"
        type="email"
        label="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <label
        htmlFor="contact-opt-in"
        className="flex items-center gap-3 cursor-pointer text-sm text-default-600"
      >
        <input
          id="contact-opt-in"
          name="contact_opt_in"
          type="checkbox"
          checked={contactOptIn}
          onChange={(e) => setContactOptIn(e.target.checked)}
          className="w-4 h-4 rounded border-default-300 text-violet-600 focus:ring-violet-500"
        />
        Keep me updated about future events.
      </label>

      <Button
        type="submit"
        color="primary"
        isDisabled={isSubmitting}
        isLoading={isSubmitting}
        className="bg-violet-600 hover:bg-violet-700 max-w-[220px]"
      >
        {isSubmitting ? 'Starting...' : 'Start Validation'}
      </Button>

      {submitError ? (
        <p role="alert" className="text-danger text-sm">{submitError}</p>
      ) : null}
    </form>
  );
}
