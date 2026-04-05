'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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
  phone: string | null;
  etransfer_email: string | null;
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

const selectClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

const statusBadgeColors: Record<string, string> = {
  Pending: 'bg-warning/10 text-warning',
  Accepted: 'bg-success/10 text-success',
  Assigned: 'bg-violet-500/10 text-violet-400',
  Declined: 'bg-danger/10 text-danger',
};

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
    <section className="grid gap-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6">
      <h2 className="text-xl font-bold text-foreground">Founder Detail</h2>

      <div className="grid gap-2">
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Name:</span> {founder.name}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Email:</span> {founder.email}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Company:</span> {founder.company_name ?? 'N/A'}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Industry:</span> {founder.industry ?? 'N/A'}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Stage:</span> {founder.stage ?? 'N/A'}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Website:</span> {founder.website ?? 'N/A'}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Phone:</span> {founder.phone ?? 'N/A'}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">E-Transfer Email:</span> {founder.etransfer_email ?? 'N/A'}
        </p>
        <p className="text-sm text-default-500">
          <span className="font-medium text-foreground">Status:</span>{' '}
          <span
            className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
              statusBadgeColors[founder.status] ?? 'bg-default-100 text-default-500'
            }`}
          >
            {founder.status}
          </span>
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-default-600">Application Status</label>
          <select
            aria-label="Application Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as FounderDetailData['status_value'])}
            disabled={isLoading || isSaving}
            className={selectClass}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="assigned">Assigned</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-default-600">Assign to Event</label>
          <select
            aria-label="Assign to Event"
            value={assignedEventId}
            onChange={(event) => setAssignedEventId(event.target.value)}
            disabled={isLoading || isSaving}
            className={selectClass}
          >
            <option value="">Unassigned</option>
            {founder.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          color="primary"
          onPress={() => void handleSave()}
          isDisabled={isLoading || isSaving || !isDirty}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          type="button"
          color="default"
          variant="flat"
          onPress={() => void handleSendConfirmation()}
          isDisabled={isLoading || isSending}
        >
          {isSending ? 'Sending...' : 'Send Confirmation'}
        </Button>
      </div>

      <div className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Submitted Application Data</h3>
        <pre className="whitespace-pre-wrap text-xs text-default-500 font-mono">
          {JSON.stringify(founder.submitted_form_data, null, 2)}
        </pre>
      </div>

      <div className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Submitted Scores (Read-only)</h3>
        <pre className="whitespace-pre-wrap text-xs text-default-500 font-mono">
          {JSON.stringify(founder.submitted_scores ?? { message: 'No submitted scores yet.' }, null, 2)}
        </pre>
      </div>

      <div className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Validation Results (Read-only)</h3>
        <pre className="whitespace-pre-wrap text-xs text-default-500 font-mono">
          {JSON.stringify(founder.validation_results ?? { message: 'No validation results yet.' }, null, 2)}
        </pre>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
