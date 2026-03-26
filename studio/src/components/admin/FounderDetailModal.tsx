'use client';

import React, { useMemo, useState } from 'react';

export interface FounderEventOption {
  id: string;
  name: string;
  status: string;
}

export interface FounderDetailData {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  pitch_summary: string | null;
  industry: string | null;
  stage: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  status: 'Pending' | 'Accepted' | 'Assigned' | 'Declined';
  status_value: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id: string | null;
  submission_date: string;
  submitted_form_data: Record<string, unknown>;
  submitted_scores: Record<string, unknown> | null;
  validation_results: Record<string, unknown> | null;
  events: FounderEventOption[];
}

interface FounderDetailModalProps {
  founder: FounderDetailData;
  isLoading: boolean;
  onSaveStatus: (status: FounderDetailData['status_value'], assignedEventId: string | null) => Promise<void>;
  onSendConfirmation: () => Promise<void>;
}

export function FounderDetailModal({
  founder,
  isLoading,
  onSaveStatus,
  onSendConfirmation,
}: FounderDetailModalProps): React.ReactElement {
  const [status, setStatus] = useState<FounderDetailData['status_value']>(founder.status_value);
  const [assignedEventId, setAssignedEventId] = useState<string>(founder.assigned_event_id ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => status !== founder.status_value || (assignedEventId || null) !== founder.assigned_event_id,
    [assignedEventId, founder.assigned_event_id, founder.status_value, status]
  );

  async function handleSave(): Promise<void> {
    setError(null);

    if (status === 'assigned' && !assignedEventId) {
      setError('Select an event before setting status to Assigned.');
      return;
    }

    try {
      setIsSaving(true);
      await onSaveStatus(status, assignedEventId || null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update founder status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendConfirmation(): Promise<void> {
    setError(null);
    try {
      setIsSending(true);
      await onSendConfirmation();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to enqueue confirmation email.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem', border: '1px solid #ddd', padding: '0.75rem' }}>
      <h2 style={{ margin: 0 }}>Founder Detail</h2>

      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <p style={{ margin: 0 }}><strong>Name:</strong> {founder.name}</p>
        <p style={{ margin: 0 }}><strong>Email:</strong> {founder.email}</p>
        <p style={{ margin: 0 }}><strong>Company:</strong> {founder.company_name ?? 'N/A'}</p>
        <p style={{ margin: 0 }}><strong>Industry:</strong> {founder.industry ?? 'N/A'}</p>
        <p style={{ margin: 0 }}><strong>Stage:</strong> {founder.stage ?? 'N/A'}</p>
        <p style={{ margin: 0 }}><strong>Website:</strong> {founder.website ?? 'N/A'}</p>
        <p style={{ margin: 0 }}><strong>Status:</strong> {founder.status}</p>
      </div>

      <label>
        Application Status
        <select
          aria-label="Application Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as FounderDetailData['status_value'])}
          disabled={isLoading || isSaving}
        >
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="assigned">Assigned</option>
          <option value="declined">Declined</option>
        </select>
      </label>

      <label>
        Assign to Event
        <select
          aria-label="Assign to Event"
          value={assignedEventId}
          onChange={(event) => setAssignedEventId(event.target.value)}
          disabled={isLoading || isSaving}
        >
          <option value="">Unassigned</option>
          {founder.events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void handleSave()} disabled={isLoading || isSaving || !isDirty}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => void handleSendConfirmation()} disabled={isLoading || isSending}>
          {isSending ? 'Sending...' : 'Send Confirmation'}
        </button>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem' }}>Submitted Application Data</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(founder.submitted_form_data, null, 2)}</pre>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem' }}>Submitted Scores (Read-only)</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(founder.submitted_scores ?? { message: 'No submitted scores yet.' }, null, 2)}
        </pre>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem' }}>Validation Results (Read-only)</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(founder.validation_results ?? { message: 'No validation results yet.' }, null, 2)}
        </pre>
      </div>

      {error ? (
        <p role="alert" style={{ margin: 0, color: '#b00' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
