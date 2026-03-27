'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="grid gap-5 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6"
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-default-600">Name</span>
        <input
          aria-label="Name"
          value={formValues.name}
          onChange={(event) => setFormValues((previous) => ({ ...previous, name: event.target.value }))}
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-default-600">Company Name</span>
        <input
          aria-label="Company Name"
          value={formValues.company_name}
          onChange={(event) => setFormValues((previous) => ({ ...previous, company_name: event.target.value }))}
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-default-600">Pitch Summary</span>
        <textarea
          aria-label="Pitch Summary"
          value={formValues.pitch_summary}
          onChange={(event) => setFormValues((previous) => ({ ...previous, pitch_summary: event.target.value }))}
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[100px] resize-y"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-default-600">Deck URL</span>
        <input
          aria-label="Deck URL"
          value={formValues.deck_url}
          onChange={(event) => setFormValues((previous) => ({ ...previous, deck_url: event.target.value }))}
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>

      <fieldset className="rounded-2xl border border-default-200 dark:border-gray-700 p-4">
        <legend className="px-2 text-sm font-medium text-default-600">Contact Preferences</legend>
        <div className="grid gap-3 mt-2">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
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
              className="accent-violet-500 h-4 w-4"
            />
            Product updates
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
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
              className="accent-violet-500 h-4 w-4"
            />
            Score notifications
          </label>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-danger text-sm m-0">
          {error}
        </p>
      ) : null}

      <Button type="submit" color="primary" isDisabled={!canSubmit || isSaving} isLoading={isSaving}>
        {isSaving ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  );
}
