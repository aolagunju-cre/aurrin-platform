export interface PlatformWaitlistSignupRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlatformWaitlistSignupUpsert {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source?: string;
  metadata?: Record<string, unknown>;
}
