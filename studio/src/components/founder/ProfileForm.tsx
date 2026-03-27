'use client';

import React, { useMemo, useState } from 'react';

export interface FounderProfileFormValues {
  name: string;
  company_name: string;
  pitch_summary: string;
  deck_url: string;
  contact_preferences: {
    product_updates: boolean;
    score_notifications: boolean;
  };
}

interface ProfileFormProps {
  initialValues: FounderProfileFormValues;
  onSubmit: (values: FounderProfileFormValues) => Promise<void>;
}

export default function ProfileForm({ initialValues, onSubmit }: ProfileFormProps): React.ReactElement {
  const [formValues, setFormValues] = useState<FounderProfileFormValues>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => formValues.name.trim().length > 0, [formValues.name]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(formValues);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} style={{ display: 'grid', gap: '0.75rem' }}>
      <label>
        Name
        <input
          aria-label="Name"
          value={formValues.name}
          onChange={(event) => setFormValues((previous) => ({ ...previous, name: event.target.value }))}
        />
      </label>

      <label>
        Company Name
        <input
          aria-label="Company Name"
          value={formValues.company_name}
          onChange={(event) => setFormValues((previous) => ({ ...previous, company_name: event.target.value }))}
        />
      </label>

      <label>
        Pitch Summary
        <textarea
          aria-label="Pitch Summary"
          value={formValues.pitch_summary}
          onChange={(event) => setFormValues((previous) => ({ ...previous, pitch_summary: event.target.value }))}
        />
      </label>

      <label>
        Deck URL
        <input
          aria-label="Deck URL"
          value={formValues.deck_url}
          onChange={(event) => setFormValues((previous) => ({ ...previous, deck_url: event.target.value }))}
        />
      </label>

      <fieldset style={{ border: '1px solid #d4d4d4', padding: '0.75rem' }}>
        <legend>Contact Preferences</legend>
        <label>
          <input
            type="checkbox"
            checked={formValues.contact_preferences.product_updates}
            onChange={(event) =>
              setFormValues((previous) => ({
                ...previous,
                contact_preferences: {
                  ...previous.contact_preferences,
                  product_updates: event.target.checked,
                },
              }))
            }
          />
          Product updates
        </label>
        <label>
          <input
            type="checkbox"
            checked={formValues.contact_preferences.score_notifications}
            onChange={(event) =>
              setFormValues((previous) => ({
                ...previous,
                contact_preferences: {
                  ...previous.contact_preferences,
                  score_notifications: event.target.checked,
                },
              }))
            }
          />
          Score notifications
        </label>
      </fieldset>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={!canSubmit || isSaving}>
        {isSaving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}
