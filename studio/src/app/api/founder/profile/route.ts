import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoFounderProfile } from '@/src/lib/demo/data';
import { requireFounderOrAdmin } from '../../../../lib/auth/founder';
import { getSupabaseClient, type FounderUpdate, type UserUpdate } from '../../../../lib/db/client';

interface FounderProfileResponse {
  founder_id: string;
  user_id: string;
  name: string | null;
  email: string;
  company_name: string | null;
  pitch_summary: string | null;
  deck_url: string | null;
  website: string | null;
  contact_preferences: Record<string, unknown> | null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toProfilePayload(founder: {
  id: string;
  user_id: string;
  company_name: string | null;
  bio: string | null;
  pitch_deck_url: string | null;
  website: string | null;
  social_proof: Record<string, unknown> | null;
}, user: { email: string; name: string | null }): FounderProfileResponse {
  const socialProof = founder.social_proof ?? {};
  const contactPreferences =
    socialProof &&
    typeof socialProof === 'object' &&
    !Array.isArray(socialProof) &&
    socialProof.contact_preferences &&
    typeof socialProof.contact_preferences === 'object' &&
    !Array.isArray(socialProof.contact_preferences)
      ? (socialProof.contact_preferences as Record<string, unknown>)
      : null;

  return {
    founder_id: founder.id,
    user_id: founder.user_id,
    name: user.name,
    email: user.email,
    company_name: founder.company_name,
    pitch_summary: founder.bio,
    deck_url: founder.pitch_deck_url,
    website: founder.website,
    contact_preferences: contactPreferences,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json(
      {
        success: true,
        data: {
          founder_id: demoFounderProfile.id,
          user_id: demoFounderProfile.id,
          name: demoFounderProfile.name,
          email: demoFounderProfile.email,
          company_name: demoFounderProfile.company,
          pitch_summary: demoFounderProfile.bio,
          deck_url: null,
          website: demoFounderProfile.website,
          contact_preferences: null,
        },
      },
      { status: 200 }
    );
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!authResult.founder) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  const client = getSupabaseClient();
  const userResult = await client.db.getUserById(authResult.userId);
  if (userResult.error) {
    return NextResponse.json({ success: false, message: userResult.error.message }, { status: 500 });
  }

  if (!userResult.data) {
    return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      data: toProfilePayload(authResult.founder, {
        email: userResult.data.email,
        name: userResult.data.name,
      }),
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: { id: demoFounderProfile.id } }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!authResult.isFounder || !authResult.founder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const updatesForUser: UserUpdate = {};
  const updatesForFounder: FounderUpdate = {};

  if ('name' in body) {
    updatesForUser.name = normalizeString(body.name);
  }
  if ('company_name' in body) {
    updatesForFounder.company_name = normalizeString(body.company_name);
  }
  if ('pitch_summary' in body) {
    updatesForFounder.bio = normalizeString(body.pitch_summary);
  }
  if ('deck_url' in body) {
    updatesForFounder.pitch_deck_url = normalizeString(body.deck_url);
  }
  if ('website' in body) {
    updatesForFounder.website = normalizeString(body.website);
  }

  if ('contact_preferences' in body) {
    const contactPreferences = normalizeObject(body.contact_preferences);
    const currentSocialProof =
      authResult.founder.social_proof &&
      typeof authResult.founder.social_proof === 'object' &&
      !Array.isArray(authResult.founder.social_proof)
        ? authResult.founder.social_proof
        : {};

    updatesForFounder.social_proof = {
      ...currentSocialProof,
      contact_preferences: contactPreferences,
    };
  }

  const client = getSupabaseClient();

  if (Object.keys(updatesForUser).length > 0) {
    const userUpdateResult = await client.db.updateUser(authResult.userId, updatesForUser);
    if (userUpdateResult.error) {
      return NextResponse.json({ success: false, message: userUpdateResult.error.message }, { status: 500 });
    }
  }

  if (Object.keys(updatesForFounder).length > 0) {
    const founderUpdateResult = await client.db.updateFounder(authResult.founder.id, updatesForFounder);
    if (founderUpdateResult.error) {
      return NextResponse.json({ success: false, message: founderUpdateResult.error.message }, { status: 500 });
    }
  }

  const founderResult = await client.db.getFounderByUserId(authResult.userId);
  if (founderResult.error) {
    return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
  }
  if (!founderResult.data) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  const userResult = await client.db.getUserById(authResult.userId);
  if (userResult.error) {
    return NextResponse.json({ success: false, message: userResult.error.message }, { status: 500 });
  }
  if (!userResult.data) {
    return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      data: toProfilePayload(founderResult.data, {
        email: userResult.data.email,
        name: userResult.data.name,
      }),
    },
    { status: 200 }
  );
}
