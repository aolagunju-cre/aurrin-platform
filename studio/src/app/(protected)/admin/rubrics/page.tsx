'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { RubricDefinition, RubricSummary } from '../../../../lib/rubrics/types';
import { RubricForm } from '../../../../components/admin/RubricForm';
import { Button } from '@heroui/button';

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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Rubrics</h1>
        <Button color="secondary" onPress={() => setShowCreate((current) => !current)} isDisabled={isCreating}>
          Create Rubric
        </Button>
      </div>

      {showCreate ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
          <RubricForm onSubmit={createRubric} submitLabel={isCreating ? 'Creating...' : 'Create Rubric'} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading rubrics...</p> : null}

      {!isLoading ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Rubrics Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Name</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Version</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Question Count</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Last Updated</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Builder</th>
              </tr>
            </thead>
            <tbody>
              {orderedRubrics.map((rubric) => (
                <tr key={rubric.id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100 text-foreground">{rubric.name}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{rubric.version}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{rubric.question_count}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(rubric.last_updated).toLocaleString()}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <a href={`/admin/rubrics/${rubric.id}`} className="text-violet-400 hover:text-violet-300 transition-colors">Open Builder</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
