'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FounderDetailData, FounderDetailModal } from '../../../../../components/admin/FounderDetailModal';

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
    return <p>Loading founder detail...</p>;
  }

  if (error) {
    return (
      <main>
        <h1>Founder Detail</h1>
        <p role="alert" style={{ color: '#b00' }}>{error}</p>
      </main>
    );
  }

  if (!founder) {
    return (
      <main>
        <h1>Founder Detail</h1>
        <p role="alert" style={{ color: '#b00' }}>Founder application not found.</p>
      </main>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{founder.name}</h1>
        <button type="button" onClick={() => router.push('/admin/founders')}>Back</button>
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
