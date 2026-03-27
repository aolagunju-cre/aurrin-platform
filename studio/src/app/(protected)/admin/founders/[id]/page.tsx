'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FounderDetailData, FounderDetailModal } from '../../../../../components/admin/FounderDetailModal';
import { Button } from '@heroui/button';

export default function AdminFounderDetailPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [founder, setFounder] = useState<FounderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFounder(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/founders/${params.id}`);
      const payload = await response.json() as { success: boolean; data?: FounderDetailData; message?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || 'Failed to load founder application detail.');
      }

      setFounder(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load founder application detail.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      void loadFounder();
    }
  }, [params.id]);

  async function saveStatus(status: FounderDetailData['status_value'], assignedEventId: string | null): Promise<void> {
    const response = await fetch(`/api/admin/founders/${params.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, assigned_event_id: assignedEventId }),
    });

    const payload = await response.json() as { success: boolean; message?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Failed to update founder status.');
    }

    await loadFounder();
  }

  async function sendConfirmation(): Promise<void> {
    const response = await fetch(`/api/admin/founders/${params.id}/send-confirmation`, {
      method: 'POST',
    });

    const payload = await response.json() as { success: boolean; message?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Failed to enqueue confirmation email.');
    }
  }

  if (isLoading) {
    return <div className="container mx-auto max-w-7xl px-6 py-8"><p className="text-default-400">Loading founder detail...</p></div>;
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-7xl px-6 py-8 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Detail</h1>
        <p role="alert" className="text-danger">{error}</p>
      </main>
    );
  }

  if (!founder) {
    return (
      <main className="container mx-auto max-w-7xl px-6 py-8 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Detail</h1>
        <p role="alert" className="text-danger">Founder application not found.</p>
      </main>
    );
  }

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{founder.name}</h1>
        <Button color="default" variant="flat" onPress={() => router.push('/admin/founders')}>Back</Button>
      </div>

      <FounderDetailModal
        founder={founder}
        isLoading={isLoading}
        onSaveStatus={saveStatus}
        onSendConfirmation={sendConfirmation}
      />
    </section>
  );
}
