'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@heroui/button';

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

interface DirectoryPublishCandidate {
  founder_id: string;
  founder_name: string | null;
  founder_email: string | null;
  company_name: string | null;
  pitch_id: string;
  visible_in_directory: boolean;
  is_published: boolean;
  public_profile_slug: string | null;
  application_status: 'pending' | 'accepted' | 'assigned' | 'declined' | null;
  eligible_for_auto_publish: boolean;
}

interface DirectoryPublishingResponse {
  success: boolean;
  data?: {
    publishing_allowed: boolean;
    candidates: DirectoryPublishCandidate[];
  };
  message?: string;
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
  const [directoryCandidates, setDirectoryCandidates] = useState<DirectoryPublishCandidate[]>([]);
  const [selectedFounderIds, setSelectedFounderIds] = useState<string[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [isPublishingDirectory, setIsPublishingDirectory] = useState(false);
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
  const publishingStartDate = eventDetail?.publishing_start ? new Date(eventDetail.publishing_start) : null;
  const publishFoundersControlEnabled = Boolean(
    eventDetail
      && eventDetail.status === 'Archived'
      && publishingStartDate
      && !Number.isNaN(publishingStartDate.getTime())
      && publishingStartDate <= new Date()
  );

  const loadDirectoryCandidates = useCallback(async (): Promise<void> => {
    if (!publishFoundersControlEnabled) {
      setDirectoryCandidates([]);
      setSelectedFounderIds([]);
      return;
    }

    setDirectoryError(null);
    const response = await fetch(`/api/admin/events/${params.id}/directory-publishing`);
    const payload = await response.json() as DirectoryPublishingResponse;
    if (!response.ok || !payload.success || !payload.data) {
      setDirectoryError(payload.message ?? 'Failed to load directory publishing candidates.');
      return;
    }
    setDirectoryCandidates(payload.data.candidates);
    setSelectedFounderIds([]);
  }, [params.id, publishFoundersControlEnabled]);

  useEffect(() => {
    if (publishFoundersControlEnabled) {
      void loadDirectoryCandidates();
    } else {
      setDirectoryCandidates([]);
      setSelectedFounderIds([]);
      setDirectoryError(null);
    }
  }, [loadDirectoryCandidates, publishFoundersControlEnabled]);

  function toggleFounderSelection(founderId: string): void {
    setSelectedFounderIds((current) => (
      current.includes(founderId)
        ? current.filter((id) => id !== founderId)
        : [...current, founderId]
    ));
  }

  async function applyDirectoryPublishing(payload: {
    founder_ids?: string[];
    auto_publish_accepted?: boolean;
    visible?: boolean;
  }): Promise<void> {
    setDirectoryError(null);
    setIsPublishingDirectory(true);
    try {
      const response = await fetch(`/api/admin/events/${params.id}/directory-publishing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? 'Failed to update founder directory visibility.');
      }
      await loadDirectoryCandidates();
    } catch (publishError) {
      setDirectoryError(publishError instanceof Error ? publishError.message : 'Failed to update founder visibility.');
    } finally {
      setIsPublishingDirectory(false);
    }
  }

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
    return <div className="container mx-auto max-w-7xl px-6 py-8"><p className="text-default-400">Loading event detail...</p></div>;
  }

  if (error) {
    return <div className="container mx-auto max-w-7xl px-6 py-8"><p role="alert" className="text-danger">{error}</p></div>;
  }

  if (!eventDetail) {
    return <div className="container mx-auto max-w-7xl px-6 py-8"><p role="alert" className="text-danger">Event not found.</p></div>;
  }

  const inputClass = "mt-1 w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500";

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{eventDetail.name}</h1>
        <p className="text-lg text-default-500 mt-1">{eventDetail.description || 'No description provided.'}</p>
      </header>

      <div className="space-y-1 text-sm text-default-500">
        <p><strong className="text-foreground">Status:</strong> <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${eventDetail.status === 'Live' ? 'bg-green-500/10 text-green-400' : eventDetail.status === 'Upcoming' ? 'bg-violet-500/10 text-violet-400' : 'bg-default-100 text-default-500'}`}>{eventDetail.status}</span></p>
        <p><strong className="text-foreground">Event Window:</strong> {new Date(eventDetail.start_date).toLocaleString()} - {new Date(eventDetail.end_date).toLocaleString()}</p>
        <p><strong className="text-foreground">Scoring Window:</strong> {eventDetail.scoring_start ? new Date(eventDetail.scoring_start).toLocaleString() : 'Not set'} - {eventDetail.scoring_end ? new Date(eventDetail.scoring_end).toLocaleString() : 'Not set'}</p>
        <p><strong className="text-foreground">Publishing Window:</strong> {eventDetail.publishing_start ? new Date(eventDetail.publishing_start).toLocaleString() : 'Not set'} - {eventDetail.publishing_end ? new Date(eventDetail.publishing_end).toLocaleString() : 'Not set'}</p>
        <p><strong className="text-foreground">Logo/Image:</strong> {eventDetail.logo_url || eventDetail.image_url || 'Not set'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button color="secondary" variant={isEditing ? 'flat' : 'solid'} onPress={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Cancel Edit' : 'Edit'}
        </Button>
        {statusActionLabel ? (
          <Button color="warning" onPress={() => setPendingStatus(getNextStatus(eventDetail.status))}>
            {statusActionLabel}
          </Button>
        ) : null}
        <a href={`/admin/events/${eventDetail.id}/sponsors`} className="text-violet-400 hover:text-violet-300 transition-colors inline-flex items-center">Manage Sponsors</a>
      </div>

      {statusError ? <p role="alert" className="text-danger">{statusError}</p> : null}

      {pendingStatus ? (
        <div role="dialog" aria-modal="true" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 max-w-md space-y-3">
          <p className="text-foreground">Are you sure?</p>
          <div className="flex gap-3">
            <Button color="secondary" onPress={() => void handleStatusChange()} isDisabled={isUpdatingStatus}>
              {isUpdatingStatus ? 'Updating...' : 'Confirm'}
            </Button>
            <Button color="default" variant="flat" onPress={() => setPendingStatus(null)} isDisabled={isUpdatingStatus}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <section className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Edit Event</h2>

          <label className="block text-sm text-default-500">
            Name
            <input aria-label="name" value={eventDraft.name} onChange={(event) => setEventDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
          </label>

          <label className="block text-sm text-default-500">
            Description
            <textarea aria-label="description" rows={3} value={eventDraft.description} onChange={(event) => setEventDraft((current) => ({ ...current, description: event.target.value }))} className={inputClass} />
          </label>

          <label className="block text-sm text-default-500">
            Start Date
            <input aria-label="start_date" type="datetime-local" value={eventDraft.start_date} onChange={(event) => setEventDraft((current) => ({ ...current, start_date: event.target.value }))} className={inputClass} />
          </label>

          <label className="block text-sm text-default-500">
            End Date
            <input aria-label="end_date" type="datetime-local" value={eventDraft.end_date} onChange={(event) => setEventDraft((current) => ({ ...current, end_date: event.target.value }))} className={inputClass} />
          </label>

          <label className="block text-sm text-default-500">
            Logo URL
            <input aria-label="logo_url" value={eventDraft.logo_url} onChange={(event) => setEventDraft((current) => ({ ...current, logo_url: event.target.value }))} className={inputClass} />
          </label>

          <label className="block text-sm text-default-500">
            Image URL
            <input aria-label="image_url" value={eventDraft.image_url} onChange={(event) => setEventDraft((current) => ({ ...current, image_url: event.target.value }))} className={inputClass} />
          </label>

          <h3 className="text-lg font-semibold text-foreground pt-2">Scoring Window</h3>
          <label className="block text-sm text-default-500">
            Scoring Start
            <input aria-label="scoring_start" type="datetime-local" value={windowDraft.scoring_start} onChange={(event) => setWindowDraft((current) => ({ ...current, scoring_start: event.target.value }))} className={inputClass} />
          </label>
          <label className="block text-sm text-default-500">
            Scoring End
            <input aria-label="scoring_end" type="datetime-local" value={windowDraft.scoring_end} onChange={(event) => setWindowDraft((current) => ({ ...current, scoring_end: event.target.value }))} className={inputClass} />
          </label>

          <h3 className="text-lg font-semibold text-foreground pt-2">Publishing Window</h3>
          <label className="block text-sm text-default-500">
            Publishing Start
            <input aria-label="publishing_start" type="datetime-local" value={windowDraft.publishing_start} onChange={(event) => setWindowDraft((current) => ({ ...current, publishing_start: event.target.value }))} className={inputClass} />
          </label>
          <label className="block text-sm text-default-500">
            Publishing End
            <input aria-label="publishing_end" type="datetime-local" value={windowDraft.publishing_end} onChange={(event) => setWindowDraft((current) => ({ ...current, publishing_end: event.target.value }))} className={inputClass} />
          </label>

          {saveError ? <p role="alert" className="text-danger">{saveError}</p> : null}

          <Button color="secondary" onPress={() => void saveEdits()} isDisabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Publish Founders to Directory</h2>
        {!publishFoundersControlEnabled ? (
          <p className="text-default-400">
            Publishing controls become available only after the event is archived and scores are published.
          </p>
        ) : (
          <>
            <p className="text-sm text-default-500">Select founders to publish or hide from the public directory.</p>
            {directoryCandidates.length === 0 ? (
              <p className="py-12 text-center text-default-400">No founders are assigned to this event yet.</p>
            ) : (
              <div className="space-y-2">
                {directoryCandidates.map((candidate) => (
                  <label key={candidate.founder_id} className="flex items-center gap-3 text-sm text-default-500">
                    <input
                      type="checkbox"
                      aria-label={`select founder ${candidate.company_name ?? candidate.founder_name ?? candidate.founder_id}`}
                      checked={selectedFounderIds.includes(candidate.founder_id)}
                      onChange={() => toggleFounderSelection(candidate.founder_id)}
                      disabled={isPublishingDirectory}
                      className="rounded border-default-300"
                    />
                    <span>
                      {(candidate.company_name ?? candidate.founder_name ?? candidate.founder_id)}
                      {' · '}
                      <span className={candidate.visible_in_directory ? 'text-green-400' : 'text-default-400'}>{candidate.visible_in_directory ? 'Visible' : 'Hidden'}</span>
                      {' · '}
                      {candidate.application_status ?? 'unknown status'}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                color="secondary"
                onPress={() => void applyDirectoryPublishing({ founder_ids: selectedFounderIds, visible: true })}
                isDisabled={isPublishingDirectory || selectedFounderIds.length === 0}
              >
                {isPublishingDirectory ? 'Updating...' : 'Publish Selected'}
              </Button>
              <Button
                size="sm"
                color="default"
                variant="flat"
                onPress={() => void applyDirectoryPublishing({ founder_ids: selectedFounderIds, visible: false })}
                isDisabled={isPublishingDirectory || selectedFounderIds.length === 0}
              >
                Hide Selected
              </Button>
              <Button
                size="sm"
                color="secondary"
                variant="flat"
                onPress={() => void applyDirectoryPublishing({ auto_publish_accepted: true, visible: true })}
                isDisabled={isPublishingDirectory}
              >
                Auto-Publish Accepted Founders
              </Button>
            </div>
          </>
        )}

        {directoryError ? <p role="alert" className="text-danger">{directoryError}</p> : null}
      </section>
    </section>
  );
}
