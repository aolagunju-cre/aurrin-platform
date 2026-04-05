import { NextRequest, NextResponse } from 'next/server';
import type { CommunityRole } from '../../../../lib/db/client';
import { getSupabaseClient } from '../../../../lib/db/client';
import { sendEmail } from '../../../../lib/email/send';
import { siteConfig } from '../../../../config/site';
import { uploadFile, UploadError } from '../../../../lib/storage/upload';

const MAX_PITCH_SUMMARY_LENGTH = 1000;
const MIN_PITCH_SUMMARY_LENGTH = 100;
const MIN_ROLE_DETAIL_LENGTH = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface FounderValidationErrors {
  full_name?: string;
  email?: string;
  company_name?: string;
  pitch_summary?: string;
  industry?: string;
  stage?: string;
  deck_file?: string;
  etransfer_email?: string;
}

interface CommunityRoleValidationErrors {
  role?: string;
  full_name?: string;
  email?: string;
  expertise?: string;
  motivation?: string;
  how_can_help?: string;
}

interface RoleApplicationPayload {
  role?: unknown;
  full_name?: unknown;
  email?: unknown;
  expertise?: unknown;
  linkedin?: unknown;
  motivation?: unknown;
  availability?: unknown;
  how_can_help?: unknown;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function textField(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function optionalTextField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function wasSubmittedWithinLastDay(updatedAt: string | null | undefined, createdAt: string | null | undefined): boolean {
  const lastSubmittedAt = Date.parse(updatedAt || createdAt || '');
  return !Number.isNaN(lastSubmittedAt) && Date.now() - lastSubmittedAt < ONE_DAY_MS;
}

async function handleFounderApplication(request: NextRequest): Promise<NextResponse> {
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
  const phone = textField(formData, 'phone');
  const etransferEmail = textField(formData, 'etransfer_email');
  const deckFile = formData.get('deck_file');

  const errors: FounderValidationErrors = {};

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
    // deck_file is optional — no required error when absent
  } else {
    if (deckFile.type !== 'application/pdf') {
      errors.deck_file = 'Pitch deck must be a PDF';
    }
    if (deckFile.size > 50 * 1024 * 1024) {
      errors.deck_file = 'Pitch deck must be 50MB or smaller';
    }
  }

  if (etransferEmail && !isValidEmail(etransferEmail)) {
    errors.etransfer_email = 'Enter a valid e-transfer email address';
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
    if (existingResult.data && wasSubmittedWithinLastDay(existingResult.data.updated_at, existingResult.data.created_at)) {
      return NextResponse.json({ success: true, message: 'Application submitted' }, { status: 200 });
    }

    const applicantRef = `public-${Buffer.from(email).toString('base64url').slice(0, 24)}`;
    const uploadResult = deckFile instanceof File
      ? await uploadFile(deckFile, 'pitch-decks', applicantRef)
      : { file_id: null, path: null };

    const saveResult = existingResult.data
      ? await client.db.updateFounderApplication(existingResult.data.id, {
          name: fullName,
          full_name: fullName,
          company_name: companyName,
          pitch_summary: pitchSummary,
          industry,
          stage,
          ...(uploadResult.file_id != null && { deck_file_id: uploadResult.file_id }),
          ...(uploadResult.path != null && { deck_path: uploadResult.path }),
          website: website || null,
          twitter: twitter || null,
          linkedin: linkedin || null,
          phone: phone || null,
          etransfer_email: etransferEmail || null,
          status: 'pending',
          assigned_event_id: null,
          reviewed_at: null,
          reviewed_by: null,
          application_data: {
            pitch_summary: pitchSummary,
            industry,
            stage,
            ...(uploadResult.file_id != null && { deck_file_id: uploadResult.file_id }),
            ...(uploadResult.path != null && { deck_path: uploadResult.path }),
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
          phone: phone || null,
          etransfer_email: etransferEmail || null,
          status: 'pending',
          application_data: {
            pitch_summary: pitchSummary,
            industry,
            stage,
            ...(uploadResult.file_id != null && { deck_file_id: uploadResult.file_id }),
            ...(uploadResult.path != null && { deck_path: uploadResult.path }),
            website: website || null,
            twitter: twitter || null,
            linkedin: linkedin || null,
          },
        });

    if (saveResult.error || !saveResult.data) {
      return NextResponse.json({ success: false, message: 'Could not save application' }, { status: 500 });
    }

    await sendEmail(email, 'welcome_founder', {
      name: fullName,
      company: companyName,
      link: `/public/apply/status?email=${encodeURIComponent(email)}`,
      email,
      application_id: saveResult.data.id,
    });

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

async function handleCommunityRoleApplication(request: NextRequest): Promise<NextResponse> {
  let body: RoleApplicationPayload;
  try {
    body = await request.json() as RoleApplicationPayload;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request: expected application/json' },
      { status: 400 }
    );
  }

  const role = optionalTextField(body.role).toLowerCase() as CommunityRole;
  const fullName = optionalTextField(body.full_name);
  const email = optionalTextField(body.email).toLowerCase();
  const expertise = optionalTextField(body.expertise);
  const linkedin = optionalTextField(body.linkedin);
  const motivation = optionalTextField(body.motivation);
  const availability = optionalTextField(body.availability);
  const howCanHelp = optionalTextField(body.how_can_help);

  const errors: CommunityRoleValidationErrors = {};

  if (role !== 'judge' && role !== 'mentor') {
    errors.role = 'Role must be judge or mentor';
  }
  if (!fullName) errors.full_name = 'Full name is required';
  if (!email) errors.email = 'Email is required';
  if (email && !isValidEmail(email)) errors.email = 'Email format is invalid';
  if (!expertise) errors.expertise = 'Expertise is required';
  if (role === 'judge') {
    if (!motivation) {
      errors.motivation = 'Motivation is required';
    } else if (motivation.length < MIN_ROLE_DETAIL_LENGTH) {
      errors.motivation = `Motivation must be at least ${MIN_ROLE_DETAIL_LENGTH} characters`;
    }
  }
  if (role === 'mentor') {
    if (!howCanHelp) {
      errors.how_can_help = 'How you can help is required';
    } else if (howCanHelp.length < MIN_ROLE_DETAIL_LENGTH) {
      errors.how_can_help = `How you can help must be at least ${MIN_ROLE_DETAIL_LENGTH} characters`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', errors },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();
  const existingResult = await client.db.getCommunityRoleApplicationByRoleAndEmail(role, email);
  if (existingResult.error) {
    return NextResponse.json(
      { success: false, message: 'Could not validate existing application' },
      { status: 500 }
    );
  }

  if (existingResult.data && wasSubmittedWithinLastDay(existingResult.data.updated_at, existingResult.data.created_at)) {
    return NextResponse.json({ success: true, message: 'Application submitted' }, { status: 200 });
  }

  try {
    const applicationData =
      role === 'judge'
        ? { motivation }
        : {
            availability: availability || null,
            how_can_help: howCanHelp,
          };

    const saveResult = await client.db.insertCommunityRoleApplication({
      role,
      email,
      full_name: fullName,
      expertise,
      linkedin: linkedin || null,
      status: 'pending',
      application_data: applicationData,
    });

    if (saveResult.error || !saveResult.data) {
      return NextResponse.json({ success: false, message: 'Could not save application' }, { status: 500 });
    }

    await sendEmail(siteConfig.contactEmail, 'community_role_application_received', {
      role,
      name: fullName,
      email,
      expertise,
      linkedin: linkedin || null,
      motivation: role === 'judge' ? motivation : null,
      availability: role === 'mentor' ? availability || null : null,
      how_can_help: role === 'mentor' ? howCanHelp : null,
      application_id: saveResult.data.id,
    });

    return NextResponse.json({ success: true, message: 'Application submitted' }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('multipart/form-data')) {
    return handleFounderApplication(request);
  }

  if (contentType.includes('application/json')) {
    return handleCommunityRoleApplication(request);
  }

  return NextResponse.json(
    {
      success: false,
      message: 'Unsupported request content type: expected multipart/form-data or application/json',
    },
    { status: 400 }
  );
}
