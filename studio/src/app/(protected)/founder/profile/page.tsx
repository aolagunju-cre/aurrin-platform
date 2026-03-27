'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ProfileForm, { type FounderProfileFormValues } from '../../../../components/founder/ProfileForm';

interface FounderProfilePayload {
  founder_id: string;
  user_id: string;
  name: string | null;
  email: string;
  company_name: string | null;
  pitch_summary: string | null;
  deck_url: string | null;
  contact_preferences: Record<string, unknown> | null;
}

function toFormValues(profile: FounderProfilePayload): FounderProfileFormValues {
  return {
    name: profile.name ?? '',
    company_name: profile.company_name ?? '',
    pitch_summary: profile.pitch_summary ?? '',
    deck_url: profile.deck_url ?? '',
    contact_preferences: {
      product_updates: Boolean(profile.contact_preferences?.product_updates),
      score_notifications: Boolean(profile.contact_preferences?.score_notifications),
    },
  };
}

export default function FounderProfilePage(): React.ReactElement {
  const [profile, setProfile] = useState<FounderProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/founder/profile');
        const payload = (await response.json()) as { success: boolean; data?: FounderProfilePayload; message?: string };
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || 'Failed to load founder profile.');
        }

        setProfile(payload.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load founder profile.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const initialValues = useMemo(() => {
    if (!profile) {
      return null;
    }
    return toFormValues(profile);
  }, [profile]);

  async function handleSubmit(values: FounderProfileFormValues): Promise<void> {
    const response = await fetch('/api/founder/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { success: boolean; data?: FounderProfilePayload; message?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || 'Failed to save founder profile.');
    }
    setProfile(payload.data);
    setSaveMessage('Profile updated.');
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>Founder Profile</h1>

      {error ? (
        <p role="alert" style={{ color: '#b00020', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading founder profile...</p> : null}

      {!isLoading && profile ? (
        <>
          <p style={{ margin: 0 }}>Email: {profile.email}</p>
          {initialValues ? <ProfileForm initialValues={initialValues} onSubmit={handleSubmit} /> : null}
          {saveMessage ? <p style={{ margin: 0 }}>{saveMessage}</p> : null}
        </>
      ) : null}
    </section>
  );
}
