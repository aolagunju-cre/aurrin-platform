'use client';

import React, { useCallback, useEffect, useState } from 'react';

type ReportType = 'full' | 'summary';

type ReportStatus = 'generating' | 'ready' | 'failed';

interface FounderReportItem {
  report_id: string;
  event_id: string;
  event_name: string | null;
  pitch_id: string;
  report_type: ReportType;
  status: ReportStatus;
  created_at: string;
  download_url: string | null;
}

interface ReportsResponse {
  success: boolean;
  data?: FounderReportItem[];
  message?: string;
}

interface GenerateResponse {
  success: boolean;
  data?: {
    job_id: string;
    status_url: string;
  };
  message?: string;
}

function statusLabel(status: ReportStatus): string {
  if (status === 'ready') {
    return 'Ready (download)';
  }
  if (status === 'failed') {
    return 'Failed (try again)';
  }
  return 'Generating...';
}

export default function FounderReportsPage(): React.ReactElement {
  const [reports, setReports] = useState<FounderReportItem[]>([]);
  const [eventId, setEventId] = useState('');
  const [pitchId, setPitchId] = useState('');
  const [reportType, setReportType] = useState<ReportType>('full');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/founder/reports');
      const payload = (await response.json()) as ReportsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to load founder reports.');
      }

      setReports(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load founder reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/founder/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          pitch_id: pitchId,
          report_type: reportType,
        }),
      });

      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to queue report generation.');
      }

      setMessage(payload.message ?? "Your report is being generated. You'll receive an email when ready.");
      await loadReports();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to queue report generation.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Founder Reports</h1>

      <form onSubmit={(event) => void handleGenerate(event)} style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
        <h2 style={{ margin: 0 }}>Generate New Report</h2>

        <label htmlFor="event-id-input">Event ID</label>
        <input
          id="event-id-input"
          name="event_id"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          placeholder="event-123"
          required
        />

        <label htmlFor="pitch-id-input">Pitch ID</label>
        <input
          id="pitch-id-input"
          name="pitch_id"
          value={pitchId}
          onChange={(event) => setPitchId(event.target.value)}
          placeholder="pitch-123"
          required
        />

        <label htmlFor="report-type-input">Report Type</label>
        <select
          id="report-type-input"
          name="report_type"
          value={reportType}
          onChange={(event) => setReportType(event.target.value as ReportType)}
        >
          <option value="full">full</option>
          <option value="summary">summary</option>
        </select>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Queueing report...' : 'Generate New Report'}
        </button>
      </form>

      {message ? <p style={{ margin: 0 }}>{message}</p> : null}
      {error ? (
        <p role="alert" style={{ margin: 0, color: '#b00020' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading reports...</p> : null}

      {!isLoading ? (
        <table aria-label="Founder Reports Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Event</th>
              <th align="left">Type</th>
              <th align="left">Created</th>
              <th align="left">Status</th>
              <th align="left">Download</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.report_id}>
                <td>{report.event_name ?? report.event_id}</td>
                <td>{report.report_type}</td>
                <td>{new Date(report.created_at).toLocaleString()}</td>
                <td>{statusLabel(report.status)}</td>
                <td>
                  {report.status === 'ready' && report.download_url ? (
                    <a href={report.download_url}>Download</a>
                  ) : (
                    <span>Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 ? (
              <tr>
                <td colSpan={5}>No reports yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
