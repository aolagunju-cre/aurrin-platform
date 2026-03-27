'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type EventStatus = 'Upcoming' | 'Live' | 'Archived';

type PendingStatus = 'Live' | 'Archived';

interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  status: EventStatus;
  start_date: string;
  end_date: string;
  scoring_start: string | null;
  scoring_end: string | null;
  publishing_start: string | null;
  publishing_end: string | null;
  logo_url: string | null;
  image_url: string | null;
}

interface EventResponse {
  success: boolean;
  data?: EventDetail;
  message?: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
}

interface EventDraft {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  logo_url: string;
  image_url: string;
}

interface WindowDraft {
  scoring_start: string;
  scoring_end: string;
  publishing_start: string;
  publishing_end: string;
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIso(value: string): string {
  return new Date(value).toISOString();
}

function getNextStatus(status: EventStatus): PendingStatus | null {
  if (status === 'Upcoming') return 'Live';
  if (status === 'Live') return 'Archived';
  return null;
}

function getStatusActionLabel(status: EventStatus): 'Go Live' | 'Archive' | null {
  if (status === 'Upcoming') return 'Go Live';
  if (status === 'Live') return 'Archive';
  return null;
}

export default function AdminEventDetailPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    logo_url: '',
    image_url: '',
  });
  const [windowDraft, setWindowDraft] = useState<WindowDraft>({
    scoring_start: '',
    scoring_end: '',
    publishing_start: '',
    publishing_end: '',
  });

  async function loadEvent(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/events/${params.id}`);
      const payload = await response.json() as EventResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message ?? 'Failed to load event.');
      }

      setEventDetail(payload.data);
      setEventDraft({
        name: payload.data.name,
        description: payload.data.description ?? '',
        start_date: toDateInputValue(payload.data.start_date),
        end_date: toDateInputValue(payload.data.end_date),
        logo_url: payload.data.logo_url ?? '',
        image_url: payload.data.image_url ?? '',
      });
      setWindowDraft({
        scoring_start: toDateInputValue(payload.data.scoring_start),
        scoring_end: toDateInputValue(payload.data.scoring_end),
        publishing_start: toDateInputValue(payload.data.publishing_start),
        publishing_end: toDateInputValue(payload.data.publishing_end),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load event.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      void loadEvent();
    }
  }, [params.id]);

  const statusActionLabel = eventDetail ? getStatusActionLabel(eventDetail.status) : null;

  async function handleStatusChange(): Promise<void> {
    if (!eventDetail || !pendingStatus) {
      return;
    }

    setStatusError(null);
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/events/${params.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: pendingStatus }),
      });
      const payload = await response.json() as EventResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message ?? 'Failed to update status.');
      }

      setEventDetail(payload.data);
      setPendingStatus(null);
    } catch (statusUpdateError) {
      setStatusError(statusUpdateError instanceof Error ? statusUpdateError.message : 'Failed to update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function validateDates(startDate: string, endDate: string, label: string): string | null {
    if (!startDate || !endDate) {
      return `${label} start_date and end_date are required.`;
    }
    if (new Date(endDate) < new Date(startDate)) {
      return `${label} end_date must be on or after start_date.`;
    }
    return null;
  }

  async function saveEdits(): Promise<void> {
    if (!eventDetail) {
      return;
    }

    const eventDateValidation = validateDates(eventDraft.start_date, eventDraft.end_date, 'Event');
    if (eventDateValidation) {
      setSaveError(eventDateValidation);
      return;
    }

    const scoringValidation = validateDates(windowDraft.scoring_start, windowDraft.scoring_end, 'Scoring window');
    if (scoringValidation) {
      setSaveError(scoringValidation);
      return;
    }

    const publishingValidation = validateDates(windowDraft.publishing_start, windowDraft.publishing_end, 'Publishing window');
    if (publishingValidation) {
      setSaveError(publishingValidation);
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const eventResponse = await fetch(`/api/admin/events/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventDraft.name,
          description: eventDraft.description || null,
          start_date: toIso(eventDraft.start_date),
          end_date: toIso(eventDraft.end_date),
          logo_url: eventDraft.logo_url || null,
          image_url: eventDraft.image_url || null,
        }),
      });
      const eventPayload = await eventResponse.json() as ApiResponse;
      if (!eventResponse.ok || !eventPayload.success) {
        throw new Error(eventPayload.message ?? 'Failed to update event details.');
      }

      const scoringResponse = await fetch(`/api/admin/events/${params.id}/scoring-window`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoring_start: toIso(windowDraft.scoring_start),
          scoring_end: toIso(windowDraft.scoring_end),
        }),
      });
      const scoringPayload = await scoringResponse.json() as ApiResponse;
      if (!scoringResponse.ok || !scoringPayload.success) {
        throw new Error(scoringPayload.message ?? 'Failed to update scoring window.');
      }

      const publishingResponse = await fetch(`/api/admin/events/${params.id}/publishing-window`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishing_start: toIso(windowDraft.publishing_start),
          publishing_end: toIso(windowDraft.publishing_end),
        }),
      });
      const publishingPayload = await publishingResponse.json() as ApiResponse;
      if (!publishingResponse.ok || !publishingPayload.success) {
        throw new Error(publishingPayload.message ?? 'Failed to update publishing window.');
      }

      setIsEditing(false);
      await loadEvent();
    } catch (saveEditError) {
      setSaveError(saveEditError instanceof Error ? saveEditError.message : 'Failed to save updates.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <p>Loading event detail...</p>;
  }

  if (error) {
    return <p role="alert" style={{ color: '#b00020' }}>{error}</p>;
  }

  if (!eventDetail) {
    return <p role="alert" style={{ color: '#b00020' }}>Event not found.</p>;
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.5rem' }}>{eventDetail.name}</h1>
        <p style={{ margin: 0 }}>{eventDetail.description || 'No description provided.'}</p>
      </header>

      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <p style={{ margin: 0 }}><strong>Status:</strong> {eventDetail.status}</p>
        <p style={{ margin: 0 }}><strong>Event Window:</strong> {new Date(eventDetail.start_date).toLocaleString()} - {new Date(eventDetail.end_date).toLocaleString()}</p>
        <p style={{ margin: 0 }}><strong>Scoring Window:</strong> {eventDetail.scoring_start ? new Date(eventDetail.scoring_start).toLocaleString() : 'Not set'} - {eventDetail.scoring_end ? new Date(eventDetail.scoring_end).toLocaleString() : 'Not set'}</p>
        <p style={{ margin: 0 }}><strong>Publishing Window:</strong> {eventDetail.publishing_start ? new Date(eventDetail.publishing_start).toLocaleString() : 'Not set'} - {eventDetail.publishing_end ? new Date(eventDetail.publishing_end).toLocaleString() : 'Not set'}</p>
        <p style={{ margin: 0 }}><strong>Logo/Image:</strong> {eventDetail.logo_url || eventDetail.image_url || 'Not set'}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Cancel Edit' : 'Edit'}
        </button>
        {statusActionLabel ? (
          <button type="button" onClick={() => setPendingStatus(getNextStatus(eventDetail.status))}>
            {statusActionLabel}
          </button>
        ) : null}
        <a href={`/admin/events/${eventDetail.id}/sponsors`}>Manage Sponsors</a>
      </div>

      {statusError ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{statusError}</p> : null}

      {pendingStatus ? (
        <div role="dialog" aria-modal="true" style={{ border: '1px solid #999', padding: '0.75rem', maxWidth: 420 }}>
          <p style={{ marginTop: 0 }}>Are you sure?</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => void handleStatusChange()} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? 'Updating...' : 'Confirm'}
            </button>
            <button type="button" onClick={() => setPendingStatus(null)} disabled={isUpdatingStatus}>Cancel</button>
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>Edit Event</h2>

          <label>
            name
            <input
              aria-label="name"
              value={eventDraft.name}
              onChange={(event) => setEventDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <label>
            description
            <textarea
              aria-label="description"
              rows={3}
              value={eventDraft.description}
              onChange={(event) => setEventDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <label>
            start_date
            <input
              aria-label="start_date"
              type="datetime-local"
              value={eventDraft.start_date}
              onChange={(event) => setEventDraft((current) => ({ ...current, start_date: event.target.value }))}
            />
          </label>

          <label>
            end_date
            <input
              aria-label="end_date"
              type="datetime-local"
              value={eventDraft.end_date}
              onChange={(event) => setEventDraft((current) => ({ ...current, end_date: event.target.value }))}
            />
          </label>

          <label>
            logo_url
            <input
              aria-label="logo_url"
              value={eventDraft.logo_url}
              onChange={(event) => setEventDraft((current) => ({ ...current, logo_url: event.target.value }))}
            />
          </label>

          <label>
            image_url
            <input
              aria-label="image_url"
              value={eventDraft.image_url}
              onChange={(event) => setEventDraft((current) => ({ ...current, image_url: event.target.value }))}
            />
          </label>

          <h3 style={{ marginBottom: 0 }}>Scoring Window</h3>
          <label>
            scoring_start
            <input
              aria-label="scoring_start"
              type="datetime-local"
              value={windowDraft.scoring_start}
              onChange={(event) => setWindowDraft((current) => ({ ...current, scoring_start: event.target.value }))}
            />
          </label>
          <label>
            scoring_end
            <input
              aria-label="scoring_end"
              type="datetime-local"
              value={windowDraft.scoring_end}
              onChange={(event) => setWindowDraft((current) => ({ ...current, scoring_end: event.target.value }))}
            />
          </label>

          <h3 style={{ marginBottom: 0 }}>Publishing Window</h3>
          <label>
            publishing_start
            <input
              aria-label="publishing_start"
              type="datetime-local"
              value={windowDraft.publishing_start}
              onChange={(event) => setWindowDraft((current) => ({ ...current, publishing_start: event.target.value }))}
            />
          </label>
          <label>
            publishing_end
            <input
              aria-label="publishing_end"
              type="datetime-local"
              value={windowDraft.publishing_end}
              onChange={(event) => setWindowDraft((current) => ({ ...current, publishing_end: event.target.value }))}
            />
          </label>

          {saveError ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{saveError}</p> : null}

          <button type="button" onClick={() => void saveEdits()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </section>
      ) : null}
    </section>
  );
}
