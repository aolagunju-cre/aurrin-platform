import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/db/client';
import { uploadFile, UploadError } from '../../../../lib/storage/upload';
import { enqueueJob } from '../../../../lib/jobs/enqueue';

const MAX_PITCH_SUMMARY_LENGTH = 1000;
const MIN_PITCH_SUMMARY_LENGTH = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ValidationErrors {
  full_name?: string;
  email?: string;
  company_name?: string;
  pitch_summary?: string;
  industry?: string;
  stage?: string;
  deck_file?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function textField(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request: expected multipart/form-data' },
      { status: 400 }
    );
  }

  const fullName = textField(formData, 'full_name');
  const email = textField(formData, 'email').toLowerCase();
  const companyName = textField(formData, 'company_name');
  const pitchSummary = textField(formData, 'pitch_summary');
  const industry = textField(formData, 'industry');
  const stage = textField(formData, 'stage');
  const website = textField(formData, 'website');
  const twitter = textField(formData, 'twitter');
  const linkedin = textField(formData, 'linkedin');
  const deckFile = formData.get('deck_file');

  const errors: ValidationErrors = {};

  if (!fullName) errors.full_name = 'Full name is required';
  if (!email) errors.email = 'Email is required';
  if (email && !isValidEmail(email)) errors.email = 'Email format is invalid';
  if (!companyName) errors.company_name = 'Company name is required';
  if (!pitchSummary) errors.pitch_summary = 'Pitch summary is required';
  if (
    pitchSummary.length < MIN_PITCH_SUMMARY_LENGTH ||
    pitchSummary.length > MAX_PITCH_SUMMARY_LENGTH
  ) {
    errors.pitch_summary = `Pitch summary must be ${MIN_PITCH_SUMMARY_LENGTH}-${MAX_PITCH_SUMMARY_LENGTH} characters`;
  }
  if (!industry) errors.industry = 'Industry is required';
  if (!stage) errors.stage = 'Stage is required';

  if (!(deckFile instanceof File)) {
    errors.deck_file = 'Pitch deck file is required';
  } else {
    if (deckFile.type !== 'application/pdf') {
      errors.deck_file = 'Pitch deck must be a PDF';
    }
    if (deckFile.size > 50 * 1024 * 1024) {
      errors.deck_file = 'Pitch deck must be 50MB or smaller';
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', errors },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();
  const existingResult = await client.db.getFounderApplicationByEmail(email);
  if (existingResult.error) {
    return NextResponse.json(
      { success: false, message: 'Could not validate existing application' },
      { status: 500 }
    );
  }

  try {
    const shouldSkipSave = existingResult.data
      ? (() => {
          const lastSubmittedAt = Date.parse(existingResult.data.updated_at || existingResult.data.created_at);
          if (!Number.isNaN(lastSubmittedAt) && Date.now() - lastSubmittedAt < ONE_DAY_MS) {
            return true;
          }
          return false;
        })()
      : false;

    if (shouldSkipSave) {
      return NextResponse.json({ success: true, message: 'Application submitted' }, { status: 200 });
    }

    const applicantRef = `public-${Buffer.from(email).toString('base64url').slice(0, 24)}`;
    const uploadResult = await uploadFile(deckFile as File, 'pitch-decks', applicantRef);

    const saveResult = existingResult.data
      ? await client.db.updateFounderApplication(existingResult.data.id, {
          name: fullName,
          full_name: fullName,
          company_name: companyName,
          pitch_summary: pitchSummary,
          industry,
          stage,
          deck_file_id: uploadResult.file_id,
          deck_path: uploadResult.path,
          website: website || null,
          twitter: twitter || null,
          linkedin: linkedin || null,
          status: 'pending',
          assigned_event_id: null,
          reviewed_at: null,
          reviewed_by: null,
          application_data: {
            pitch_summary: pitchSummary,
            industry,
            stage,
            deck_file_id: uploadResult.file_id,
            deck_path: uploadResult.path,
            website: website || null,
            twitter: twitter || null,
            linkedin: linkedin || null,
          },
        })
      : await client.db.insertFounderApplication({
          email,
          name: fullName,
          full_name: fullName,
          company_name: companyName,
          pitch_summary: pitchSummary,
          industry,
          stage,
          deck_file_id: uploadResult.file_id,
          deck_path: uploadResult.path,
          website: website || null,
          twitter: twitter || null,
          linkedin: linkedin || null,
          status: 'pending',
          application_data: {
            pitch_summary: pitchSummary,
            industry,
            stage,
            deck_file_id: uploadResult.file_id,
            deck_path: uploadResult.path,
            website: website || null,
            twitter: twitter || null,
            linkedin: linkedin || null,
          },
        });

    if (saveResult.error || !saveResult.data) {
      return NextResponse.json({ success: false, message: 'Could not save application' }, { status: 500 });
    }

    await enqueueJob(
      'email',
      {
        to: email,
        template: 'welcome_email',
        data: {
          subject: 'Thanks for applying to Aurrin Ventures',
          status_link: `/public/apply/status?email=${encodeURIComponent(email)}`,
          full_name: fullName,
          company_name: companyName,
          application_id: saveResult.data.id,
        },
      },
      {
        aggregate_id: saveResult.data.id,
        aggregate_type: 'founder_application',
      }
    );

    return NextResponse.json({ success: true, message: 'Application submitted' }, { status: 200 });
  } catch (error) {
    if (error instanceof UploadError) {
      const status =
        error.code === 'INVALID_MIME_TYPE' || error.code === 'FILE_TOO_LARGE' ? 400 : 500;
      return NextResponse.json({ success: false, message: error.message }, { status });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
