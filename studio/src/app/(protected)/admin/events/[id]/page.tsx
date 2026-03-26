'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EventForm, EventFormValues } from '../../../../../components/admin/EventForm';

interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  status: 'Upcoming' | 'Live' | 'Archived';
  start_date: string;
  end_date: string;
  max_judges: number | null;
  max_founders: number | null;
  rubric_id: string | null;
  config: Record<string, unknown>;
}

interface JudgeCandidate {
  id: string;
  email: string;
  name: string | null;
}

interface FounderCandidate {
  id: string;
  email: string;
  name: string;
  company_name: string | null;
  status: string;
  assigned_event_id: string | null;
}

function toDateInputValue(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toStatusValue(status: EventFormValues['status']): 'upcoming' | 'live' | 'archived' {
  if (status === 'Live') return 'live';
  if (status === 'Archived') return 'archived';
  return 'upcoming';
}

export default function AdminEventDetailPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [judgeCandidates, setJudgeCandidates] = useState<JudgeCandidate[]>([]);
  const [assignedJudgeIds, setAssignedJudgeIds] = useState<string[]>([]);
  const [founderCandidates, setFounderCandidates] = useState<FounderCandidate[]>([]);
  const [assignedFounderIds, setAssignedFounderIds] = useState<string[]>([]);
  const [showJudgeAssign, setShowJudgeAssign] = useState(false);
  const [showFounderAssign, setShowFounderAssign] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showSponsorEditor, setShowSponsorEditor] = useState(false);
  const [isSavingAux, setIsSavingAux] = useState(false);
  const [validationRules, setValidationRules] = useState('');
  const [sponsors, setSponsors] = useState('');

  async function loadEventData(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [eventResponse, judgesResponse, foundersResponse] = await Promise.all([
        fetch(`/api/admin/events/${params.id}`),
        fetch(`/api/admin/events/${params.id}/assign-judges`),
        fetch(`/api/admin/events/${params.id}/assign-founders`),
      ]);

      const eventPayload = await eventResponse.json() as { success: boolean; data?: EventDetail; message?: string };
      const judgesPayload = await judgesResponse.json() as {
        success: boolean;
        data?: { candidates: JudgeCandidate[]; assigned_user_ids: string[] };
      };
      const foundersPayload = await foundersResponse.json() as {
        success: boolean;
        data?: { candidates: FounderCandidate[]; assigned_founder_application_ids: string[] };
      };

      if (!eventResponse.ok || !eventPayload.success || !eventPayload.data) {
        throw new Error(eventPayload.message || 'Failed to load event.');
      }

      setEventDetail(eventPayload.data);
      setJudgeCandidates(judgesPayload.data?.candidates ?? []);
      setAssignedJudgeIds(judgesPayload.data?.assigned_user_ids ?? []);
      setFounderCandidates(foundersPayload.data?.candidates ?? []);
      setAssignedFounderIds(foundersPayload.data?.assigned_founder_application_ids ?? []);

      const eventConfig = eventPayload.data.config ?? {};
      setValidationRules(JSON.stringify(eventConfig.validation ?? {}, null, 2));
      setSponsors(JSON.stringify(eventConfig.sponsors ?? [], null, 2));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load event detail.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      void loadEventData();
    }
  }, [params.id]);

  const initialFormValues = useMemo<EventFormValues>(() => {
    if (!eventDetail) {
      return {
        name: '',
        start_date: '',
        end_date: '',
        description: '',
        max_judges: 0,
        max_founders: 0,
        rubric_id: '',
        status: 'Upcoming',
        config: '{}',
      };
    }

    return {
      name: eventDetail.name,
      start_date: toDateInputValue(eventDetail.start_date),
      end_date: toDateInputValue(eventDetail.end_date),
      description: eventDetail.description ?? '',
      max_judges: eventDetail.max_judges ?? 0,
      max_founders: eventDetail.max_founders ?? 0,
      rubric_id: eventDetail.rubric_id ?? '',
      status: eventDetail.status,
      config: JSON.stringify(eventDetail.config ?? {}, null, 2),
    };
  }, [eventDetail]);

  async function saveEvent(values: EventFormValues): Promise<void> {
    const parsedConfig = values.config.trim() ? JSON.parse(values.config) as Record<string, unknown> : {};

    const response = await fetch(`/api/admin/events/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        start_date: new Date(values.start_date).toISOString(),
        end_date: new Date(values.end_date).toISOString(),
        description: values.description || null,
        max_judges: values.max_judges,
        max_founders: values.max_founders,
        rubric_id: values.rubric_id || null,
        status: toStatusValue(values.status),
        config: parsedConfig,
      }),
    });

    const payload = await response.json() as { success: boolean; message?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Failed to save event.');
    }

    await loadEventData();
  }

  async function saveJudgeAssignments(): Promise<void> {
    setIsSavingAux(true);
    try {
      const response = await fetch(`/api/admin/events/${params.id}/assign-judges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judge_user_ids: assignedJudgeIds }),
      });
      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to assign judges.');
      }
      setShowJudgeAssign(false);
    } finally {
      setIsSavingAux(false);
    }
  }

  async function saveFounderAssignments(): Promise<void> {
    setIsSavingAux(true);
    try {
      const response = await fetch(`/api/admin/events/${params.id}/assign-founders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ founder_application_ids: assignedFounderIds }),
      });
      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to assign founders.');
      }
      setShowFounderAssign(false);
    } finally {
      setIsSavingAux(false);
    }
  }

  async function saveConfigOrSponsors(): Promise<void> {
    if (!eventDetail) {
      return;
    }

    setIsSavingAux(true);
    try {
      const mergedConfig = {
        ...(eventDetail.config ?? {}),
        validation: JSON.parse(validationRules || '{}'),
        sponsors: JSON.parse(sponsors || '[]'),
      };

      const response = await fetch(`/api/admin/events/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: mergedConfig }),
      });
      const payload = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to update event config.');
      }
      setShowConfigEditor(false);
      setShowSponsorEditor(false);
      await loadEventData();
    } finally {
      setIsSavingAux(false);
    }
  }

  if (isLoading) {
    return <p>Loading event detail...</p>;
  }

  if (error) {
    return (
      <main>
        <h1>Event Detail</h1>
        <p role="alert" style={{ color: '#b00' }}>{error}</p>
      </main>
    );
  }

  if (!eventDetail) {
    return (
      <main>
        <h1>Event Detail</h1>
        <p role="alert" style={{ color: '#b00' }}>Event not found.</p>
      </main>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>{eventDetail.name}</h1>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setShowJudgeAssign((current) => !current)}>Assign Judges</button>
        <button type="button" onClick={() => setShowFounderAssign((current) => !current)}>Assign Founders</button>
        <button type="button" onClick={() => setShowConfigEditor((current) => !current)}>Configure Validation</button>
        <button type="button" onClick={() => setShowSponsorEditor((current) => !current)}>Add Sponsor</button>
      </div>

      {showJudgeAssign ? (
        <div style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <h2 style={{ marginTop: 0 }}>Assign Judges</h2>
          {judgeCandidates.map((judge) => (
            <label key={judge.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={assignedJudgeIds.includes(judge.id)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setAssignedJudgeIds((current) => Array.from(new Set([...current, judge.id])));
                  } else {
                    setAssignedJudgeIds((current) => current.filter((id) => id !== judge.id));
                  }
                }}
              />
              {judge.name ?? 'Unknown'} ({judge.email})
            </label>
          ))}
          <button type="button" onClick={() => void saveJudgeAssignments()} disabled={isSavingAux}>
            {isSavingAux ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : null}

      {showFounderAssign ? (
        <div style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <h2 style={{ marginTop: 0 }}>Assign Founders</h2>
          {founderCandidates.map((founder) => (
            <label key={founder.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={assignedFounderIds.includes(founder.id)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setAssignedFounderIds((current) => Array.from(new Set([...current, founder.id])));
                  } else {
                    setAssignedFounderIds((current) => current.filter((id) => id !== founder.id));
                  }
                }}
              />
              {founder.name} ({founder.email}) {founder.company_name ? `- ${founder.company_name}` : ''}
            </label>
          ))}
          <button type="button" onClick={() => void saveFounderAssignments()} disabled={isSavingAux}>
            {isSavingAux ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : null}

      {showConfigEditor ? (
        <div style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <h2 style={{ marginTop: 0 }}>Configure Validation</h2>
          <textarea
            aria-label="Validation Config"
            rows={8}
            value={validationRules}
            onChange={(event) => setValidationRules(event.target.value)}
            style={{ width: '100%' }}
          />
          <button type="button" onClick={() => void saveConfigOrSponsors()} disabled={isSavingAux}>
            {isSavingAux ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : null}

      {showSponsorEditor ? (
        <div style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
          <h2 style={{ marginTop: 0 }}>Add Sponsor</h2>
          <textarea
            aria-label="Sponsor Config"
            rows={8}
            value={sponsors}
            onChange={(event) => setSponsors(event.target.value)}
            style={{ width: '100%' }}
          />
          <button type="button" onClick={() => void saveConfigOrSponsors()} disabled={isSavingAux}>
            {isSavingAux ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : null}

      <EventForm
        initialValues={initialFormValues}
        onSubmit={saveEvent}
        onCancel={() => router.push('/admin/events')}
        submitLabel="Save"
      />
    </section>
  );
}
