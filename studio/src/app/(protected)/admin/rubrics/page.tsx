'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { RubricDefinition, RubricSummary } from '../../../../lib/rubrics/types';
import { RubricForm } from '../../../../components/admin/RubricForm';

const starterDefinition: RubricDefinition = {
  categories: [
    {
      name: 'Market Opportunity',
      weight: 100,
      questions: [
        {
          text: 'How large and urgent is the target market problem?',
          scale: [1, 2, 3, 4, 5],
          response_type: 'score',
        },
      ],
    },
  ],
};

export default function AdminRubricsPage(): React.ReactElement {
  const [rubrics, setRubrics] = useState<RubricSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function loadRubrics(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/rubrics');
      const payload = await response.json() as { success: boolean; data?: RubricSummary[]; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load rubrics.');
      }
      setRubrics(payload.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load rubrics.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRubrics();
  }, []);

  const orderedRubrics = useMemo(
    () => [...rubrics].sort((left, right) => right.last_updated.localeCompare(left.last_updated)),
    [rubrics]
  );

  async function createRubric(payload: { name: string; description: string }): Promise<void> {
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/rubrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          definition: starterDefinition,
        }),
      });

      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create rubric.');
      }

      setShowCreate(false);
      await loadRubrics();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Rubrics</h1>
        <button type="button" onClick={() => setShowCreate((current) => !current)} disabled={isCreating}>
          Create Rubric
        </button>
      </div>

      {showCreate ? (
        <RubricForm onSubmit={createRubric} submitLabel={isCreating ? 'Creating...' : 'Create Rubric'} />
      ) : null}

      {error ? (
        <p role="alert" style={{ color: '#b00', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading rubrics...</p> : null}

      {!isLoading ? (
        <table aria-label="Rubrics Table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Version</th>
              <th align="left">Question Count</th>
              <th align="left">Last Updated</th>
              <th align="left">Builder</th>
            </tr>
          </thead>
          <tbody>
            {orderedRubrics.map((rubric) => (
              <tr key={rubric.id}>
                <td>{rubric.name}</td>
                <td>{rubric.version}</td>
                <td>{rubric.question_count}</td>
                <td>{new Date(rubric.last_updated).toLocaleString()}</td>
                <td>
                  <a href={`/admin/rubrics/${rubric.id}`}>Open Builder</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
