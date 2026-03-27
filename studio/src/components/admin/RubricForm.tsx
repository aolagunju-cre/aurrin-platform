'use client';

import React, { useState } from 'react';
import { Button } from '@heroui/button';

interface RubricFormProps {
  initialName?: string;
  initialDescription?: string;
  onSubmit: (payload: { name: string; description: string }) => Promise<void>;
  submitLabel?: string;
}

const inputClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

export function RubricForm({
  initialName = '',
  initialDescription = '',
  onSubmit,
  submitLabel = 'Save Rubric',
}: RubricFormProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      setError('Rubric name is required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save rubric.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
          className={inputClass}
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-default-600">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isSubmitting}
          className={`${inputClass} resize-none`}
          rows={3}
        />
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" color="primary" isDisabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
