'use client';

import React, { useState } from 'react';

interface RubricFormProps {
  initialName?: string;
  initialDescription?: string;
  onSubmit: (payload: { name: string; description: string }) => Promise<void>;
  submitLabel?: string;
}

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
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} disabled={isSubmitting} />
      </label>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        Description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSubmitting} />
      </label>

      {error ? (
        <p role="alert" style={{ color: '#b00', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
