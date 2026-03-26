'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RubricBuilder } from '../../../../../components/admin/RubricBuilder';
import type { RubricDefinition, RubricTemplateRecord, RubricVersionRecord } from '../../../../../lib/rubrics/types';

export default function RubricBuilderPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<RubricTemplateRecord | null>(null);
  const [latest, setLatest] = useState<RubricVersionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadRubric(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/rubrics/${params.id}`);
      const payload = await response.json() as {
        success: boolean;
        message?: string;
        data?: { template: RubricTemplateRecord; latest: RubricVersionRecord | null };
      };

      if (!response.ok || !payload.success || !payload.data?.latest) {
        throw new Error(payload.message || 'Failed to load rubric detail.');
      }

      setTemplate(payload.data.template);
      setLatest(payload.data.latest);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load rubric detail.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      void loadRubric();
    }
  }, [params.id]);

  async function handleSave(payload: { name: string; description: string; definition: RubricDefinition }): Promise<void> {
    const response = await fetch(`/api/admin/rubrics/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as { success: boolean; message?: string };
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to save rubric changes.');
    }

    await loadRubric();
  }

  async function handleClone(): Promise<void> {
    const response = await fetch(`/api/admin/rubrics/${params.id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await response.json() as {
      success: boolean;
      message?: string;
      data?: { template: RubricTemplateRecord };
    };

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.message || 'Failed to clone rubric.');
    }

    router.push(`/admin/rubrics/${result.data.template.id}`);
  }

  if (isLoading) {
    return <p>Loading rubric builder...</p>;
  }

  if (error) {
    return (
      <main>
        <h1>Rubric Builder</h1>
        <p role="alert" style={{ color: '#b00' }}>{error}</p>
      </main>
    );
  }

  if (!template || !latest) {
    return (
      <main>
        <h1>Rubric Builder</h1>
        <p role="alert" style={{ color: '#b00' }}>Rubric data is unavailable.</p>
      </main>
    );
  }

  return <RubricBuilder rubric={template} latestVersion={latest} onSave={handleSave} onClone={handleClone} />;
}
