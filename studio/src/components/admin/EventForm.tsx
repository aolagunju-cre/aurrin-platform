'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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

const inputClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

const selectClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

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
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="grid gap-4 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6"
    >
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Name</label>
        <input
          aria-label="Event Name"
          value={values.name}
          onChange={(event) => updateValue('name', event.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-default-600">Start Date</label>
          <input
            aria-label="Start Date"
            type="datetime-local"
            value={values.start_date}
            onChange={(event) => updateValue('start_date', event.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-default-600">End Date</label>
          <input
            aria-label="End Date"
            type="datetime-local"
            value={values.end_date}
            onChange={(event) => updateValue('end_date', event.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Description</label>
        <textarea
          aria-label="Description"
          value={values.description}
          onChange={(event) => updateValue('description', event.target.value)}
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-default-600">Max Judges</label>
          <input
            aria-label="Max Judges"
            type="number"
            min={0}
            value={values.max_judges}
            onChange={(event) => updateValue('max_judges', Number(event.target.value))}
            className={inputClass}
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-default-600">Max Founders</label>
          <input
            aria-label="Max Founders"
            type="number"
            min={0}
            value={values.max_founders}
            onChange={(event) => updateValue('max_founders', Number(event.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Rubric Id</label>
        <input
          aria-label="Rubric Id"
          value={values.rubric_id}
          onChange={(event) => updateValue('rubric_id', event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Status</label>
        <select
          aria-label="Status"
          value={values.status}
          onChange={(event) => updateValue('status', event.target.value as EventFormValues['status'])}
          className={selectClass}
        >
          <option>Upcoming</option>
          <option>Live</option>
          <option>Archived</option>
        </select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Config (JSON)</label>
        <textarea
          aria-label="Config JSON"
          value={values.config}
          onChange={(event) => updateValue('config', event.target.value)}
          rows={6}
          className={`${inputClass} resize-none font-mono text-sm`}
        />
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <Button type="submit" color="primary" isDisabled={isSaving || !isDirty}>
          {isSaving ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" color="default" variant="flat" onPress={onCancel} isDisabled={isSaving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
