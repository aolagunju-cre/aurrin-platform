'use client';

import React, { useMemo, useState } from 'react';

export interface EventFormValues {
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  max_judges: number;
  max_founders: number;
  rubric_id: string;
  status: 'Upcoming' | 'Live' | 'Archived';
  config: string;
}

interface EventFormProps {
  initialValues: EventFormValues;
  onSubmit: (values: EventFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function EventForm({ initialValues, onSubmit, onCancel, submitLabel }: EventFormProps): React.ReactElement {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initialValues), [initialValues, values]);

  function updateValue<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!values.name.trim()) {
      setError('Event name is required.');
      return;
    }

    if (!values.start_date || !values.end_date) {
      setError('Start date and end date are required.');
      return;
    }

    if (new Date(values.end_date) < new Date(values.start_date)) {
      setError('End date must be on or after start date.');
      return;
    }

    try {
      setIsSaving(true);
      await onSubmit(values);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save event.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} style={{ display: 'grid', gap: '0.75rem' }}>
      <label>
        Name
        <input
          aria-label="Event Name"
          value={values.name}
          onChange={(event) => updateValue('name', event.target.value)}
          required
        />
      </label>

      <label>
        Start Date
        <input
          aria-label="Start Date"
          type="datetime-local"
          value={values.start_date}
          onChange={(event) => updateValue('start_date', event.target.value)}
          required
        />
      </label>

      <label>
        End Date
        <input
          aria-label="End Date"
          type="datetime-local"
          value={values.end_date}
          onChange={(event) => updateValue('end_date', event.target.value)}
          required
        />
      </label>

      <label>
        Description
        <textarea
          aria-label="Description"
          value={values.description}
          onChange={(event) => updateValue('description', event.target.value)}
          rows={4}
        />
      </label>

      <label>
        Max Judges
        <input
          aria-label="Max Judges"
          type="number"
          min={0}
          value={values.max_judges}
          onChange={(event) => updateValue('max_judges', Number(event.target.value))}
        />
      </label>

      <label>
        Max Founders
        <input
          aria-label="Max Founders"
          type="number"
          min={0}
          value={values.max_founders}
          onChange={(event) => updateValue('max_founders', Number(event.target.value))}
        />
      </label>

      <label>
        Rubric Id
        <input
          aria-label="Rubric Id"
          value={values.rubric_id}
          onChange={(event) => updateValue('rubric_id', event.target.value)}
        />
      </label>

      <label>
        Status
        <select
          aria-label="Status"
          value={values.status}
          onChange={(event) => updateValue('status', event.target.value as EventFormValues['status'])}
        >
          <option>Upcoming</option>
          <option>Live</option>
          <option>Archived</option>
        </select>
      </label>

      <label>
        Config (JSON)
        <textarea
          aria-label="Config JSON"
          value={values.config}
          onChange={(event) => updateValue('config', event.target.value)}
          rows={6}
        />
      </label>

      {error ? (
        <p role="alert" style={{ margin: 0, color: '#b00' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={isSaving || !isDirty}>
          {isSaving ? 'Saving...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
