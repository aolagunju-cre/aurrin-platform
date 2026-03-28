import { getRuntimeEnv } from '../config/env';
import type { CampaignRecord, CampaignInsert, CampaignUpdate, CampaignDonationRecord } from './types';

function getHeaders(): Record<string, string> {
  const env = getRuntimeEnv();
  const key = env.supabaseServiceRoleKey ?? '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function getBaseUrl(): string {
  const env = getRuntimeEnv();
  return env.supabaseUrl ?? '';
}

export async function listActiveCampaigns(): Promise<{ data: CampaignRecord[]; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaigns?status=in.(active,funded)&order=created_at.desc&limit=50`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return { data: [], error: new Error(`Query failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignRecord[];
    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function getCampaignById(id: string): Promise<{ data: CampaignRecord | null; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaigns?id=eq.${encodeURIComponent(id)}&limit=1`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return { data: null, error: new Error(`Query failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignRecord[];
    return { data: rows[0] ?? null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function listCampaignsByFounderId(founderId: string): Promise<{ data: CampaignRecord[]; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaigns?founder_id=eq.${encodeURIComponent(founderId)}&order=created_at.desc`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return { data: [], error: new Error(`Query failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignRecord[];
    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function insertCampaign(record: CampaignInsert): Promise<{ data: CampaignRecord | null; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaigns`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(record),
    });
    if (!response.ok) return { data: null, error: new Error(`Insert failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignRecord[];
    return { data: rows[0] ?? null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function updateCampaign(id: string, updates: CampaignUpdate): Promise<{ data: CampaignRecord | null; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaigns?id=eq.${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return { data: null, error: new Error(`Update failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignRecord[];
    return { data: rows[0] ?? null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function listDonationsByCampaignId(campaignId: string): Promise<{ data: CampaignDonationRecord[]; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaign_donations?campaign_id=eq.${encodeURIComponent(campaignId)}&order=created_at.desc&limit=100`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return { data: [], error: new Error(`Query failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignDonationRecord[];
    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function insertDonation(record: {
  campaign_id: string;
  donor_name?: string;
  donor_email?: string;
  amount_cents: number;
  is_anonymous?: boolean;
  stripe_session_id?: string;
}): Promise<{ data: CampaignDonationRecord | null; error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/campaign_donations`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(record),
    });
    if (!response.ok) return { data: null, error: new Error(`Insert failed: ${response.statusText}`) };
    const rows = await response.json() as CampaignDonationRecord[];
    return { data: rows[0] ?? null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function incrementCampaignRaised(campaignId: string, amountCents: number): Promise<{ error: Error | null }> {
  try {
    const url = `${getBaseUrl()}/rest/v1/rpc/increment_campaign_raised`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ campaign_id_input: campaignId, amount_input: amountCents }),
    });
    if (!response.ok) return { error: new Error(`RPC failed: ${response.statusText}`) };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
