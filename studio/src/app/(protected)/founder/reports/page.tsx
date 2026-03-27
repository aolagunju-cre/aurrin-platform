'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@heroui/button';

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

  const inputClass = "w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500";

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Reports</h1>

      <form onSubmit={(event) => void handleGenerate(event)} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3 max-w-lg">
        <h2 className="text-xl font-semibold text-foreground">Generate New Report</h2>

        <label htmlFor="event-id-input" className="block text-sm text-default-500">Event ID</label>
        <input
          id="event-id-input"
          name="event_id"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          placeholder="event-123"
          required
          className={inputClass}
        />

        <label htmlFor="pitch-id-input" className="block text-sm text-default-500">Pitch ID</label>
        <input
          id="pitch-id-input"
          name="pitch_id"
          value={pitchId}
          onChange={(event) => setPitchId(event.target.value)}
          placeholder="pitch-123"
          required
          className={inputClass}
        />

        <label htmlFor="report-type-input" className="block text-sm text-default-500">Report Type</label>
        <select
          id="report-type-input"
          name="report_type"
          value={reportType}
          onChange={(event) => setReportType(event.target.value as ReportType)}
          className={inputClass}
        >
          <option value="full">full</option>
          <option value="summary">summary</option>
        </select>

        <Button type="submit" color="secondary" isDisabled={isSubmitting}>
          {isSubmitting ? 'Queueing report...' : 'Generate New Report'}
        </Button>
      </form>

      {message ? <p className="text-sm text-green-400">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading reports...</p> : null}

      {!isLoading ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Founder Reports Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Event</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Type</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Created</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Status</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.report_id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100 text-foreground">{report.event_name ?? report.event_id}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{report.report_type}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(report.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      report.status === 'ready' ? 'bg-green-500/10 text-green-400' :
                      report.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>{statusLabel(report.status)}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-default-100">
                    {report.status === 'ready' && report.download_url ? (
                      <a href={report.download_url} className="text-violet-400 hover:text-violet-300 transition-colors">Download</a>
                    ) : (
                      <span className="text-default-400">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-default-400">No reports yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
