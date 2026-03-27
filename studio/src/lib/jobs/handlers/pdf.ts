import type { JobResult } from '../types';
import { randomUUID } from 'crypto';
import { getSupabaseClient } from '../../db/client';

export interface PdfPayload {
  event_id: string;
  founder_id: string;
  pitch_id: string;
  report_type: 'full' | 'summary';
}

interface PdfJobContext {
  jobId?: string;
}

const REPORT_RETENTION_DAYS = 7;
const REPORT_SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

function buildReportBuffer(data: PdfPayload, reportId: string): Buffer {
  const generatedAt = new Date().toISOString();
  const content = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >> endobj',
    `4 0 obj << /Length 210 >> stream
BT
/F1 12 Tf
50 760 Td
(Aurrin Founder Report) Tj
0 -20 Td
(Report ID: ${reportId}) Tj
0 -20 Td
(Founder ID: ${data.founder_id}) Tj
0 -20 Td
(Event ID: ${data.event_id}) Tj
0 -20 Td
(Pitch ID: ${data.pitch_id}) Tj
0 -20 Td
(Type: ${data.report_type}) Tj
0 -20 Td
(Generated: ${generatedAt}) Tj
ET
endstream endobj`,
    'xref',
    '0 5',
    '0000000000 65535 f ',
    '0000000010 00000 n ',
    '0000000060 00000 n ',
    '0000000117 00000 n ',
    '0000000223 00000 n ',
    'trailer << /Size 5 /Root 1 0 R >>',
    'startxref',
    '560',
    '%%EOF',
  ].join('\n');

  return Buffer.from(content, 'utf8');
}

export async function handlePdfJob(payload: Record<string, unknown>, context: PdfJobContext = {}): Promise<JobResult> {
  const { event_id, founder_id, pitch_id, report_type } = payload as unknown as Partial<PdfPayload>;
  if (!event_id || !founder_id || !pitch_id || (report_type !== 'full' && report_type !== 'summary')) {
    return { success: false, error: 'PDF job missing required fields: founder_id, event_id, pitch_id, report_type' };
  }

  const client = getSupabaseClient();
  const reportId = context.jobId ?? randomUUID();
  const fileName = `report-${reportId}.pdf`;
  const relativeStoragePath = `${founder_id}/${Date.now()}-${fileName}`;
  const storagePath = `generated-reports/${relativeStoragePath}`;
  const fileBuffer = buildReportBuffer({ founder_id, event_id, pitch_id, report_type }, reportId);

  const uploadResult = await client.storage.upload('generated-reports', relativeStoragePath, fileBuffer, {
    contentType: 'application/pdf',
  });
  if (uploadResult.error) {
    return { success: false, error: `Failed to upload generated report: ${uploadResult.error.message}` };
  }

  const expiresAt = new Date(Date.now() + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const insertResult = await client.db.insertFile({
    owner_id: founder_id,
    file_name: fileName,
    file_type: 'application/pdf',
    file_size: fileBuffer.length,
    storage_path: storagePath,
    signed_url_expiry: REPORT_SIGNED_URL_EXPIRY_SECONDS,
    retention_days: REPORT_RETENTION_DAYS,
    is_public: false,
    expires_at: expiresAt,
  });

  if (insertResult.error || !insertResult.data) {
    await client.storage.remove('generated-reports', [relativeStoragePath]);
    return { success: false, error: `Failed to record generated report: ${insertResult.error?.message ?? 'unknown error'}` };
  }

  return { success: true };
}
