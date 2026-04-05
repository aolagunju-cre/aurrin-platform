/**
 * Supabase client abstraction.
 * Provides a minimal interface for database and storage operations,
 * allowing easy mocking in tests without the Supabase SDK.
 */

import { randomUUID } from 'crypto';
import type { OutboxJob, OutboxJobInsert, OutboxJobState } from '../jobs/types';
import type {
  RubricDefinition,
  RubricTemplateRecord,
  RubricVersionRecord,
} from '../rubrics/types';
import { getRuntimeEnv } from '../config/env';

export type { OutboxJob, OutboxJobInsert, OutboxJobState };

export interface FileRecord {
  id: string;
  owner_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  signed_url_expiry: number | null;
  retention_days: number | null;
  is_public: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface FounderApplicationRecord {
  id: string;
  email: string;
  name: string;
  full_name: string | null;
  company_name: string | null;
  pitch_summary: string | null;
  industry: string | null;
  stage: string | null;
  deck_file_id: string | null;
  deck_path: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  phone: string | null;
  etransfer_email: string | null;
  funding_goal_cents: number | null;
  status: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id: string | null;
  application_data: Record<string, unknown> | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FounderApplicationInsert {
  email: string;
  name: string;
  full_name?: string | null;
  company_name?: string | null;
  pitch_summary?: string | null;
  industry?: string | null;
  stage?: string | null;
  deck_file_id?: string | null;
  deck_path?: string | null;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  etransfer_email?: string | null;
  assigned_event_id?: string | null;
  status?: 'pending' | 'accepted' | 'assigned' | 'declined';
  application_data?: Record<string, unknown>;
}

export interface FounderApplicationUpdate {
  name?: string;
  full_name?: string | null;
  company_name?: string | null;
  pitch_summary?: string | null;
  industry?: string | null;
  stage?: string | null;
  deck_file_id?: string | null;
  deck_path?: string | null;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  etransfer_email?: string | null;
  funding_goal_cents?: number | null;
  status?: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  application_data?: Record<string, unknown>;
}

export type CommunityRole = 'judge' | 'mentor';
export type CommunityRoleApplicationStatus = 'pending' | 'accepted' | 'declined';

export interface CommunityRoleApplicationRecord {
  id: string;
  role: CommunityRole;
  email: string;
  full_name: string;
  expertise: string;
  linkedin: string | null;
  application_data: Record<string, unknown>;
  status: CommunityRoleApplicationStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityRoleApplicationInsert {
  role: CommunityRole;
  email: string;
  full_name: string;
  expertise: string;
  linkedin?: string | null;
  application_data?: Record<string, unknown>;
  status?: CommunityRoleApplicationStatus;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  unsubscribed: boolean;
  unsubscribe_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface FounderRecord {
  id: string;
  user_id: string;
  company_name: string | null;
  tagline: string | null;
  bio: string | null;
  website: string | null;
  pitch_deck_url: string | null;
  social_proof: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignmentRecord {
  id: string;
  user_id: string;
  role: string;
  scope: string;
  scoped_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface RoleAssignmentActorRecord {
  id: string;
  email: string;
  name: string | null;
}

export interface RoleAssignmentListRecord extends RoleAssignmentRecord {
  user: RoleAssignmentActorRecord | null;
  assigned_by_user: RoleAssignmentActorRecord | null;
}

export interface RoleAssignmentInsert {
  user_id: string;
  role: string;
  scope: string;
  scoped_id?: string | null;
  created_by: string;
}

export type EventStatus = 'upcoming' | 'live' | 'archived';

export interface EventRecord {
  id: string;
  name: string;
  description: string | null;
  status: EventStatus;
  start_date: string;
  end_date: string;
  scoring_start: string | null;
  scoring_end: string | null;
  publishing_start: string | null;
  publishing_end: string | null;
  archived_at: string | null;
  starts_at: string;
  ends_at: string;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EventInsert {
  name: string;
  description?: string | null;
  status?: EventStatus;
  start_date?: string;
  end_date?: string;
  starts_at?: string;
  ends_at?: string;
  scoring_start?: string | null;
  scoring_end?: string | null;
  publishing_start?: string | null;
  publishing_end?: string | null;
  archived_at?: string | null;
  config?: Record<string, unknown>;
}

export interface EventUpdate {
  name?: string;
  description?: string | null;
  status?: EventStatus;
  start_date?: string;
  end_date?: string;
  starts_at?: string;
  ends_at?: string;
  scoring_start?: string | null;
  scoring_end?: string | null;
  publishing_start?: string | null;
  publishing_end?: string | null;
  archived_at?: string | null;
  config?: Record<string, unknown>;
}

export type SponsorTier = 'bronze' | 'silver' | 'gold';
export type SponsorScope = 'event' | 'site-wide';
export type SponsorStatus = 'active' | 'inactive';

export interface SponsorRecord {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: SponsorTier;
  placement_scope: SponsorScope;
  event_id: string | null;
  end_date: string | null;
  pricing_cents: number;
  status: SponsorStatus;
  display_priority: number;
  created_at: string;
  updated_at: string;
}

export interface SponsorInsert {
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  tier: SponsorTier;
  placement_scope: SponsorScope;
  event_id?: string | null;
  end_date?: string | null;
  pricing_cents: number;
  status?: SponsorStatus;
  display_priority?: number;
}

export interface SponsorUpdate {
  name?: string;
  logo_url?: string | null;
  website_url?: string | null;
  tier?: SponsorTier;
  placement_scope?: SponsorScope;
  event_id?: string | null;
  end_date?: string | null;
  pricing_cents?: number;
  status?: SponsorStatus;
  display_priority?: number;
}

export type JudgeScoreState = 'draft' | 'submitted' | 'locked';

export interface JudgeScoreRecord {
  id: string;
  judge_id: string;
  founder_pitch_id: string;
  rubric_version_id: string;
  responses: Record<string, unknown>;
  comments: string | null;
  total_score: number | null;
  category_scores: Record<string, unknown>;
  state: JudgeScoreState;
  submitted_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JudgeScoreUpsert {
  judge_id: string;
  founder_pitch_id: string;
  rubric_version_id: string;
  responses: Record<string, unknown>;
  comments?: string | null;
  total_score?: number | null;
  category_scores?: Record<string, unknown>;
  state?: JudgeScoreState;
  submitted_at?: string | null;
  locked_at?: string | null;
}

export interface AudienceSessionRecord {
  id: string;
  event_id: string;
  session_token: string;
  ip_address: string | null;
  email: string | null;
  consent_given: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface AudienceSessionInsert {
  event_id: string;
  session_token: string;
  ip_address?: string | null;
  email?: string | null;
  consent_given?: boolean;
  expires_at?: string | null;
}

export interface AudienceResponseRecord {
  id: string;
  audience_session_id: string;
  founder_pitch_id: string;
  responses: Record<string, unknown>;
  submitted_at: string | null;
  created_at: string;
}

export interface AudienceResponseInsert {
  audience_session_id: string;
  founder_pitch_id: string;
  responses: Record<string, unknown>;
  submitted_at?: string | null;
}

export interface FounderPitchRecord {
  id: string;
  founder_id: string;
  event_id: string;
  pitch_order: number | null;
  pitch_deck_url: string | null;
  score_aggregate: number | null;
  score_breakdown: Record<string, unknown> | null;
  validation_summary: Record<string, unknown> | null;
  is_published: boolean;
  published_at: string | null;
  visible_in_directory: boolean;
  public_profile_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface FounderPitchUpdate {
  is_published?: boolean;
  published_at?: string | null;
  visible_in_directory?: boolean;
}

export type MentorMatchStatus = 'pending' | 'accepted' | 'declined';

export interface MentorMatchRecord {
  id: string;
  mentor_id: string;
  founder_id: string;
  event_id: string | null;
  mentor_status: MentorMatchStatus;
  founder_status: MentorMatchStatus;
  mentor_accepted_at: string | null;
  founder_accepted_at: string | null;
  declined_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentorMatchInsert {
  mentor_id: string;
  founder_id: string;
  event_id: string | null;
  mentor_status?: MentorMatchStatus;
  founder_status?: MentorMatchStatus;
  mentor_accepted_at?: string | null;
  founder_accepted_at?: string | null;
  declined_by?: string | null;
  notes?: string | null;
}

export interface MentorMatchUpdate {
  mentor_status?: MentorMatchStatus;
  founder_status?: MentorMatchStatus;
  mentor_accepted_at?: string | null;
  founder_accepted_at?: string | null;
  declined_by?: string | null;
  notes?: string | null;
}

export interface MentorMatchPairRecord {
  mentor_id: string;
  founder_id: string;
  created_at: string;
}

export interface JudgeEventPitchRecord extends FounderPitchRecord {
  founder: {
    id: string;
    company_name: string | null;
    user: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  } | null;
}

export interface JudgePitchDetailRecord extends FounderPitchRecord {
  founder: {
    id: string;
    company_name: string | null;
    tagline: string | null;
    bio: string | null;
    website: string | null;
    pitch_deck_url: string | null;
    user: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  } | null;
}

export interface UserSearchRecord {
  id: string;
  email: string;
  name: string | null;
}

export interface UserInsert {
  id?: string;
  email: string;
  name?: string | null;
  unsubscribed?: boolean;
  unsubscribe_token?: string | null;
}

export interface UserUpdate {
  name?: string | null;
  avatar_url?: string | null;
  unsubscribed?: boolean;
  unsubscribe_token?: string | null;
}

export interface FounderInsert {
  user_id: string;
  company_name?: string | null;
  website?: string | null;
}

export interface FounderUpdate {
  company_name?: string | null;
  tagline?: string | null;
  bio?: string | null;
  website?: string | null;
  pitch_deck_url?: string | null;
  social_proof?: Record<string, unknown> | null;
}

export interface StorageUploadResult {
  path: string;
  error: Error | null;
}

export interface StorageUrlResult {
  signedUrl: string;
  error: Error | null;
}

export interface AuditLogInsert {
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  changes?: Record<string, unknown>;
  reason?: string | null;
}

export interface RubricTemplateInsert {
  name: string;
  description?: string | null;
}

export interface RubricTemplateUpdate {
  name?: string;
  description?: string | null;
}

export interface RubricVersionInsert {
  rubric_template_id: string;
  version: number;
  definition: RubricDefinition;
  event_id?: string | null;
}

export type CommerceBillingInterval = 'monthly' | 'yearly';
export type CommerceSubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'unpaid';
export type CommerceTransactionStatus = 'succeeded' | 'failed' | 'refunded';
export type EntitlementSource = 'subscription' | 'purchase';

export interface ProductRecord {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string | null;
  product_type: 'subscription' | 'digital';
  access_type: 'perpetual' | 'time-limited' | null;
  file_id: string | null;
  file_path: string | null;
  sales_count: number;
  revenue_cents: number;
  status: 'draft' | 'active' | 'archived';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInsert {
  name: string;
  description?: string | null;
  stripe_product_id?: string | null;
  product_type?: 'subscription' | 'digital';
  access_type?: 'perpetual' | 'time-limited' | null;
  file_id?: string | null;
  file_path?: string | null;
  sales_count?: number;
  revenue_cents?: number;
  status?: 'draft' | 'active' | 'archived';
  active?: boolean;
}

export interface ProductUpdate {
  name?: string;
  description?: string | null;
  stripe_product_id?: string | null;
  product_type?: 'subscription' | 'digital';
  access_type?: 'perpetual' | 'time-limited' | null;
  file_id?: string | null;
  file_path?: string | null;
  sales_count?: number;
  revenue_cents?: number;
  status?: 'draft' | 'active' | 'archived';
  active?: boolean;
}

export interface PriceRecord {
  id: string;
  product_id: string;
  stripe_price_id: string | null;
  amount_cents: number;
  currency: string;
  billing_interval: CommerceBillingInterval;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceInsert {
  product_id: string;
  stripe_price_id?: string | null;
  amount_cents: number;
  currency?: string;
  billing_interval: CommerceBillingInterval;
  active?: boolean;
}

export interface PriceUpdate {
  stripe_price_id?: string | null;
  amount_cents?: number;
  currency?: string;
  billing_interval?: CommerceBillingInterval;
  active?: boolean;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  price_id: string | null;
  status: CommerceSubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUpsert {
  id?: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id?: string | null;
  price_id?: string | null;
  status: CommerceSubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at?: string | null;
}

export interface TransactionRecord {
  id: string;
  user_id: string | null;
  subscription_id: string | null;
  stripe_event_id: string;
  event_type: string;
  amount_cents: number | null;
  currency: string | null;
  status: CommerceTransactionStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TransactionInsert {
  user_id?: string | null;
  subscription_id?: string | null;
  stripe_event_id: string;
  event_type: string;
  amount_cents?: number | null;
  currency?: string | null;
  status: CommerceTransactionStatus;
  metadata?: Record<string, unknown> | null;
}

export interface EntitlementRecord {
  id: string;
  user_id: string;
  product_id: string;
  granted_at: string;
  expires_at: string | null;
  source: EntitlementSource;
  created_at: string;
}

export interface EntitlementInsert {
  user_id: string;
  product_id: string;
  granted_at?: string;
  expires_at?: string | null;
  source: EntitlementSource;
}

export interface ContentRecord {
  id: string;
  title: string | null;
  body: string | null;
  product_id: string | null;
  requires_subscription: boolean;
  created_at: string;
  updated_at: string;
}

export interface SponsorshipTierRecord {
  id: string;
  founder_id: string;
  label: string;
  amount_cents: number;
  perk_description: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SponsorshipTierInsert {
  founder_id: string;
  label: string;
  amount_cents: number;
  perk_description: string;
  sort_order?: number;
  active?: boolean;
}

export interface SponsorshipTierUpdate {
  label?: string;
  amount_cents?: number;
  perk_description?: string;
  sort_order?: number;
  active?: boolean;
}

export interface SupabaseStorageClient {
  upload(bucket: string, path: string, file: Buffer | Blob, options?: { contentType?: string }): Promise<StorageUploadResult>;
  remove(bucket: string, paths: string[]): Promise<{ error: Error | null }>;
  createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<StorageUrlResult>;
}

export interface SupabaseDBClient {
  queryTable<T>(table: string, query: string): Promise<{ data: T[]; error: Error | null }>;
  insertFile(record: Omit<FileRecord, 'id' | 'created_at'>): Promise<{ data: FileRecord | null; error: Error | null }>;
  getFile(fileId: string): Promise<{ data: FileRecord | null; error: Error | null }>;
  deleteFile(fileId: string): Promise<{ error: Error | null }>;
  getExpiredFiles(beforeDate: Date): Promise<{ data: FileRecord[]; error: Error | null }>;
  deleteExpiredAudienceSessions(beforeDate: Date): Promise<{ deleted: number; error: Error | null }>;
  insertAudienceSession(record: AudienceSessionInsert): Promise<{ data: AudienceSessionRecord | null; error: Error | null }>;
  getAudienceSessionById(id: string): Promise<{ data: AudienceSessionRecord | null; error: Error | null }>;
  listAudienceSessionsByEventAndIp(
    eventId: string,
    ipAddress: string,
    excludeSessionId?: string
  ): Promise<{ data: AudienceSessionRecord[]; error: Error | null }>;
  listAudienceSessionsByEventAndEmail(
    eventId: string,
    email: string,
    excludeSessionId?: string
  ): Promise<{ data: AudienceSessionRecord[]; error: Error | null }>;
  getAudienceResponseBySessionAndFounderPitch(
    sessionId: string,
    founderPitchId: string
  ): Promise<{ data: AudienceResponseRecord | null; error: Error | null }>;
  listAudienceResponsesByFounderPitchAndSessionIds(
    founderPitchId: string,
    sessionIds: string[]
  ): Promise<{ data: AudienceResponseRecord[]; error: Error | null }>;
  insertAudienceResponse(record: AudienceResponseInsert): Promise<{ data: AudienceResponseRecord | null; error: Error | null }>;
  insertAuditLog(log: AuditLogInsert): Promise<{ error: Error | null }>;
  insertOutboxJob(job: OutboxJobInsert): Promise<{ data: OutboxJob | null; error: Error | null }>;
  fetchPendingJobs(limit: number): Promise<{ data: OutboxJob[]; error: Error | null }>;
  updateJobState(
    id: string,
    state: OutboxJobState,
    updates?: Partial<
      Pick<
        OutboxJob,
        'last_error' | 'retry_count' | 'scheduled_at' | 'started_at' | 'completed_at' | 'email_id' | 'error_message'
      >
    >
  ): Promise<{ error: Error | null }>;
  getFounderApplicationById(id: string): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  getFounderApplicationByEmail(email: string): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  getCommunityRoleApplicationByRoleAndEmail(
    role: CommunityRole,
    email: string
  ): Promise<{ data: CommunityRoleApplicationRecord | null; error: Error | null }>;
  getUserById(id: string): Promise<{ data: UserRecord | null; error: Error | null }>;
  insertFounderApplication(record: FounderApplicationInsert): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  insertCommunityRoleApplication(
    record: CommunityRoleApplicationInsert
  ): Promise<{ data: CommunityRoleApplicationRecord | null; error: Error | null }>;
  updateFounderApplication(id: string, updates: FounderApplicationUpdate): Promise<{ data: FounderApplicationRecord | null; error: Error | null }>;
  getUserByEmail(email: string): Promise<{ data: UserRecord | null; error: Error | null }>;
  insertUser(record: UserInsert): Promise<{ data: UserRecord | null; error: Error | null }>;
  updateUser(id: string, updates: UserUpdate): Promise<{ data: UserRecord | null; error: Error | null }>;
  getFounderByUserId(userId: string): Promise<{ data: FounderRecord | null; error: Error | null }>;
  insertFounder(record: FounderInsert): Promise<{ data: FounderRecord | null; error: Error | null }>;
  updateFounder(id: string, updates: FounderUpdate): Promise<{ data: FounderRecord | null; error: Error | null }>;
  getRoleAssignmentsByUserId(userId: string): Promise<{ data: RoleAssignmentRecord[]; error: Error | null }>;
  listRoleAssignments(): Promise<{ data: RoleAssignmentListRecord[]; error: Error | null }>;
  insertRoleAssignment(record: RoleAssignmentInsert): Promise<{ data: RoleAssignmentRecord | null; error: Error | null }>;
  deleteRoleAssignment(id: string): Promise<{ data: RoleAssignmentRecord | null; error: Error | null }>;
  listEvents(): Promise<{ data: EventRecord[]; error: Error | null }>;
  listEventsByIds(ids: string[]): Promise<{ data: EventRecord[]; error: Error | null }>;
  getEventById(id: string): Promise<{ data: EventRecord | null; error: Error | null }>;
  insertEvent(record: EventInsert): Promise<{ data: EventRecord | null; error: Error | null }>;
  updateEvent(id: string, updates: EventUpdate): Promise<{ data: EventRecord | null; error: Error | null }>;
  listFounderPitchesByEventId(eventId: string): Promise<{ data: JudgeEventPitchRecord[]; error: Error | null }>;
  listMentorIdsByEventId(eventId: string): Promise<{ data: string[]; error: Error | null }>;
  listFounderIdsByEventId(eventId: string): Promise<{ data: string[]; error: Error | null }>;
  listRecentMentorPairs(
    mentorIds: string[],
    founderIds: string[],
    createdAfterIso: string
  ): Promise<{ data: MentorMatchPairRecord[]; error: Error | null }>;
  insertMentorMatch(record: MentorMatchInsert): Promise<{ data: MentorMatchRecord | null; error: Error | null }>;
  getMentorMatchById(id: string): Promise<{ data: MentorMatchRecord | null; error: Error | null }>;
  updateMentorMatchById(id: string, updates: MentorMatchUpdate): Promise<{ data: MentorMatchRecord | null; error: Error | null }>;
  deleteMentorMatchById(id: string): Promise<{ data: MentorMatchRecord | null; error: Error | null }>;
  getFounderPitchById(id: string): Promise<{ data: JudgePitchDetailRecord | null; error: Error | null }>;
  updateFounderPitch(id: string, updates: FounderPitchUpdate): Promise<{ data: FounderPitchRecord | null; error: Error | null }>;
  getLatestRubricVersionByEventId(eventId: string): Promise<{ data: RubricVersionRecord | null; error: Error | null }>;
  getJudgeScoreByJudgeAndPitch(
    judgeId: string,
    founderPitchId: string
  ): Promise<{ data: JudgeScoreRecord | null; error: Error | null }>;
  insertJudgeScore(record: JudgeScoreUpsert): Promise<{ data: JudgeScoreRecord | null; error: Error | null }>;
  updateJudgeScore(id: string, updates: Partial<JudgeScoreUpsert>): Promise<{ data: JudgeScoreRecord | null; error: Error | null }>;
  listSponsors(): Promise<{ data: SponsorRecord[]; error: Error | null }>;
  getSponsorById(id: string): Promise<{ data: SponsorRecord | null; error: Error | null }>;
  insertSponsor(record: SponsorInsert): Promise<{ data: SponsorRecord | null; error: Error | null }>;
  updateSponsor(id: string, updates: SponsorUpdate): Promise<{ data: SponsorRecord | null; error: Error | null }>;
  deleteSponsor(id: string): Promise<{ error: Error | null }>;
  searchUsersByEmail(query: string, limit?: number): Promise<{ data: UserSearchRecord[]; error: Error | null }>;
  listRubricTemplates(): Promise<{ data: RubricTemplateRecord[]; error: Error | null }>;
  getRubricTemplateById(id: string): Promise<{ data: RubricTemplateRecord | null; error: Error | null }>;
  insertRubricTemplate(record: RubricTemplateInsert): Promise<{ data: RubricTemplateRecord | null; error: Error | null }>;
  updateRubricTemplate(id: string, updates: RubricTemplateUpdate): Promise<{ data: RubricTemplateRecord | null; error: Error | null }>;
  listRubricVersionsByTemplateId(templateId: string): Promise<{ data: RubricVersionRecord[]; error: Error | null }>;
  getLatestRubricVersionByTemplateId(templateId: string): Promise<{ data: RubricVersionRecord | null; error: Error | null }>;
  insertRubricVersion(record: RubricVersionInsert): Promise<{ data: RubricVersionRecord | null; error: Error | null }>;
  listProducts(activeOnly?: boolean): Promise<{ data: ProductRecord[]; error: Error | null }>;
  getProductById(id: string): Promise<{ data: ProductRecord | null; error: Error | null }>;
  insertProduct(record: ProductInsert): Promise<{ data: ProductRecord | null; error: Error | null }>;
  updateProduct(id: string, updates: ProductUpdate): Promise<{ data: ProductRecord | null; error: Error | null }>;
  deleteProduct(id: string): Promise<{ error: Error | null }>;
  listPricesByProductId(productId: string, activeOnly?: boolean): Promise<{ data: PriceRecord[]; error: Error | null }>;
  getPriceById(id: string): Promise<{ data: PriceRecord | null; error: Error | null }>;
  insertPrice(record: PriceInsert): Promise<{ data: PriceRecord | null; error: Error | null }>;
  updatePrice(id: string, updates: PriceUpdate): Promise<{ data: PriceRecord | null; error: Error | null }>;
  deletePrice(id: string): Promise<{ error: Error | null }>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<{ data: SubscriptionRecord | null; error: Error | null }>;
  getSubscriptionById(subscriptionId: string): Promise<{ data: SubscriptionRecord | null; error: Error | null }>;
  listSubscriptionsByUserId(userId: string): Promise<{ data: SubscriptionRecord[]; error: Error | null }>;
  requestSubscriptionCancellation(subscriptionId: string): Promise<{ data: SubscriptionRecord | null; error: Error | null }>;
  upsertSubscription(record: SubscriptionUpsert): Promise<{ data: SubscriptionRecord | null; error: Error | null }>;
  getTransactionByStripeEventId(stripeEventId: string): Promise<{ data: TransactionRecord | null; error: Error | null }>;
  insertTransaction(record: TransactionInsert): Promise<{ data: TransactionRecord | null; error: Error | null }>;
  listEntitlementsByUserId(userId: string): Promise<{ data: EntitlementRecord[]; error: Error | null }>;
  insertEntitlement(record: EntitlementInsert): Promise<{ data: EntitlementRecord | null; error: Error | null }>;
  getContentById(contentId: string): Promise<{ data: ContentRecord | null; error: Error | null }>;
  listSponsorshipTiersByFounderId(founderId: string): Promise<{ data: SponsorshipTierRecord[]; error: Error | null }>;
  getSponsorshipTierById(id: string): Promise<{ data: SponsorshipTierRecord | null; error: Error | null }>;
  insertSponsorshipTier(record: SponsorshipTierInsert): Promise<{ data: SponsorshipTierRecord | null; error: Error | null }>;
  updateSponsorshipTier(id: string, updates: SponsorshipTierUpdate): Promise<{ data: SponsorshipTierRecord | null; error: Error | null }>;
  deleteSponsorshipTier(id: string): Promise<{ error: Error | null }>;
}

export interface SupabaseClient {
  storage: SupabaseStorageClient;
  db: SupabaseDBClient;
}

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const runtimeEnv = getRuntimeEnv();
  const supabaseUrl = runtimeEnv.supabaseUrl;
  const supabaseKey = runtimeEnv.supabaseServiceRoleKey || runtimeEnv.supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    // Return a stub that throws descriptive errors when called
    const stub: SupabaseClient = {
      storage: {
        upload: async () => ({ path: '', error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        remove: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        createSignedUrl: async () => ({ signedUrl: '', error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
      },
      db: {
        queryTable: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertFile: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getFile: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteFile: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getExpiredFiles: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteExpiredAudienceSessions: async () => ({
          deleted: 0,
          error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)'),
        }),
        insertAudienceSession: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getAudienceSessionById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listAudienceSessionsByEventAndIp: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listAudienceSessionsByEventAndEmail: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getAudienceResponseBySessionAndFounderPitch: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listAudienceResponsesByFounderPitchAndSessionIds: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertAudienceResponse: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertAuditLog: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertOutboxJob: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        fetchPendingJobs: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateJobState: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getFounderApplicationById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getFounderApplicationByEmail: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getCommunityRoleApplicationByRoleAndEmail: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getUserById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertFounderApplication: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertCommunityRoleApplication: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateFounderApplication: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getUserByEmail: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertUser: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateUser: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getFounderByUserId: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertFounder: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateFounder: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getRoleAssignmentsByUserId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listRoleAssignments: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertRoleAssignment: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteRoleAssignment: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listEvents: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listEventsByIds: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getEventById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertEvent: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateEvent: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listFounderPitchesByEventId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listMentorIdsByEventId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listFounderIdsByEventId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listRecentMentorPairs: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertMentorMatch: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getMentorMatchById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateMentorMatchById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteMentorMatchById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getFounderPitchById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateFounderPitch: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getLatestRubricVersionByEventId: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getJudgeScoreByJudgeAndPitch: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertJudgeScore: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateJudgeScore: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listSponsors: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getSponsorById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertSponsor: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateSponsor: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteSponsor: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        searchUsersByEmail: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listRubricTemplates: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getRubricTemplateById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertRubricTemplate: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateRubricTemplate: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listRubricVersionsByTemplateId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getLatestRubricVersionByTemplateId: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertRubricVersion: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listProducts: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getProductById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertProduct: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateProduct: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteProduct: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listPricesByProductId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getPriceById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertPrice: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updatePrice: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deletePrice: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getSubscriptionByStripeId: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getSubscriptionById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listSubscriptionsByUserId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        requestSubscriptionCancellation: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        upsertSubscription: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getTransactionByStripeEventId: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertTransaction: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listEntitlementsByUserId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertEntitlement: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getContentById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        listSponsorshipTiersByFounderId: async () => ({ data: [], error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        getSponsorshipTierById: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        insertSponsorshipTier: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        updateSponsorshipTier: async () => ({ data: null, error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
        deleteSponsorshipTier: async () => ({ error: new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (legacy aliases: SUPABASE_URL and SUPABASE_SERVICE_KEY)') }),
      },
    };
    return stub;
  }

  // Real implementation using Supabase REST API (no SDK dependency)
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const storage: SupabaseStorageClient = {
    async upload(bucket, path, file, options) {
      try {
        let requestBody: NonNullable<RequestInit['body']>;
        if (file instanceof Buffer) {
          requestBody = Uint8Array.from(file);
        } else {
          requestBody = file as Blob;
        }
        const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': options?.contentType || 'application/octet-stream',
          },
          body: requestBody,
        });
        if (!response.ok) {
          return { path: '', error: new Error(`Storage upload failed: ${response.statusText}`) };
        }
        return { path: `${bucket}/${path}`, error: null };
      } catch (err) {
        return { path: '', error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async remove(bucket, paths) {
      try {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ prefixes: paths }),
        });
        if (!response.ok) {
          return { error: new Error(`Storage delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async createSignedUrl(bucket, path, expiresIn) {
      try {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ expiresIn }),
        });
        if (!response.ok) {
          return { signedUrl: '', error: new Error(`Signed URL failed: ${response.statusText}`) };
        }
        const data = await response.json() as { signedURL: string };
        return { signedUrl: `${supabaseUrl}/storage/v1${data.signedURL}`, error: null };
      } catch (err) {
        return { signedUrl: '', error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
  };

  const db: SupabaseDBClient = {
    async queryTable<T>(table: string, query: string) {
      try {
        const normalizedQuery = query ? (query.startsWith('?') ? query.slice(1) : query) : '';
        const url = normalizedQuery
          ? `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${normalizedQuery}`
          : `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`DB query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as T[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertFile(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/files`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(record),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`DB insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FileRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFile(fileId) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${fileId}&select=*`, {
          headers,
        });
        if (!response.ok) {
          return { data: null, error: new Error(`DB get failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FileRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteFile(fileId) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/files?id=eq.${fileId}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          return { error: new Error(`DB delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getExpiredFiles(beforeDate) {
      try {
        const iso = beforeDate.toISOString();
        const response = await fetch(
          `${supabaseUrl}/rest/v1/files?expires_at=lt.${iso}&select=*`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`DB query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FileRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteExpiredAudienceSessions(beforeDate) {
      try {
        const iso = beforeDate.toISOString();
        const response = await fetch(
          `${supabaseUrl}/rest/v1/audience_sessions?expires_at=lt.${encodeURIComponent(iso)}&select=id`,
          {
            method: 'DELETE',
            headers: { ...headers, Prefer: 'return=representation' },
          }
        );
        if (!response.ok) {
          return { deleted: 0, error: new Error(`Audience session cleanup failed: ${response.statusText}`) };
        }
        const rows = await response.json() as Array<{ id: string }>;
        return { deleted: rows.length, error: null };
      } catch (err) {
        return { deleted: 0, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertAudienceSession(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/audience_sessions`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            event_id: record.event_id,
            session_token: record.session_token,
            ip_address: record.ip_address ?? null,
            email: record.email ?? null,
            consent_given: record.consent_given ?? false,
            expires_at: record.expires_at ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Audience session insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceSessionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getAudienceSessionById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/audience_sessions?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Audience session query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceSessionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listAudienceSessionsByEventAndIp(eventId, ipAddress, excludeSessionId) {
      try {
        const filter = excludeSessionId
          ? `event_id=eq.${encodeURIComponent(eventId)}&ip_address=eq.${encodeURIComponent(ipAddress)}&id=neq.${encodeURIComponent(excludeSessionId)}`
          : `event_id=eq.${encodeURIComponent(eventId)}&ip_address=eq.${encodeURIComponent(ipAddress)}`;
        const response = await fetch(
          `${supabaseUrl}/rest/v1/audience_sessions?${filter}&select=*`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Audience sessions query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceSessionRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listAudienceSessionsByEventAndEmail(eventId, email, excludeSessionId) {
      try {
        const filter = excludeSessionId
          ? `event_id=eq.${encodeURIComponent(eventId)}&email=eq.${encodeURIComponent(email)}&id=neq.${encodeURIComponent(excludeSessionId)}`
          : `event_id=eq.${encodeURIComponent(eventId)}&email=eq.${encodeURIComponent(email)}`;
        const response = await fetch(
          `${supabaseUrl}/rest/v1/audience_sessions?${filter}&select=*`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Audience sessions query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceSessionRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getAudienceResponseBySessionAndFounderPitch(sessionId, founderPitchId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/audience_responses?audience_session_id=eq.${encodeURIComponent(sessionId)}&founder_pitch_id=eq.${encodeURIComponent(founderPitchId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Audience response query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceResponseRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listAudienceResponsesByFounderPitchAndSessionIds(founderPitchId, sessionIds) {
      if (sessionIds.length === 0) {
        return { data: [], error: null };
      }

      try {
        const inClause = `(${sessionIds.map((id) => encodeURIComponent(id)).join(',')})`;
        const response = await fetch(
          `${supabaseUrl}/rest/v1/audience_responses?founder_pitch_id=eq.${encodeURIComponent(founderPitchId)}&audience_session_id=in.${inClause}&select=*`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Audience responses query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceResponseRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertAudienceResponse(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/audience_responses`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            audience_session_id: record.audience_session_id,
            founder_pitch_id: record.founder_pitch_id,
            responses: record.responses,
            submitted_at: record.submitted_at ?? new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Audience response insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as AudienceResponseRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertAuditLog(log) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            actor_id: log.actor_id,
            action: log.action,
            resource_type: log.resource_type,
            resource_id: log.resource_id ?? null,
            changes: log.changes ?? {},
            reason: log.reason ?? null,
          }),
        });
        if (!response.ok) {
          return { error: new Error(`Audit log insert failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertOutboxJob(job) {
      try {
        const body: Record<string, unknown> = {
          job_type: job.job_type,
          payload: job.payload,
          aggregate_id: job.aggregate_id ?? null,
          aggregate_type: job.aggregate_type ?? null,
          scheduled_at: job.scheduled_at ?? null,
          max_retries: job.max_retries ?? 3,
        };
        const response = await fetch(`${supabaseUrl}/rest/v1/outbox_jobs`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Outbox insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as OutboxJob[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async fetchPendingJobs(limit) {
      try {
        const now = new Date().toISOString();
        // Fetch pending jobs where scheduled_at is null (immediate) or in the past
        const url =
          `${supabaseUrl}/rest/v1/outbox_jobs` +
          `?state=eq.pending` +
          `&or=(scheduled_at.is.null,scheduled_at.lte.${encodeURIComponent(now)})` +
          `&order=created_at.asc` +
          `&limit=${limit}` +
          `&select=*`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Fetch pending jobs failed: ${response.statusText}`) };
        }
        const rows = await response.json() as OutboxJob[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateJobState(id, state, updates = {}) {
      try {
        const body: Record<string, unknown> = { state };
        if (updates.last_error !== undefined) body.last_error = updates.last_error;
        if (updates.retry_count !== undefined) body.retry_count = updates.retry_count;
        if (updates.scheduled_at !== undefined) body.scheduled_at = updates.scheduled_at;
        if (updates.started_at !== undefined) body.started_at = updates.started_at;
        if (updates.completed_at !== undefined) body.completed_at = updates.completed_at;
        if (updates.email_id !== undefined) body.email_id = updates.email_id;
        if (updates.error_message !== undefined) body.error_message = updates.error_message;
        const response = await fetch(`${supabaseUrl}/rest/v1/outbox_jobs?id=eq.${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          return { error: new Error(`Update job state failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFounderApplicationById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_applications?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFounderApplicationByEmail(email) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_applications?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getCommunityRoleApplicationByRoleAndEmail(role, email) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/community_role_applications?role=eq.${encodeURIComponent(role)}&email=eq.${encodeURIComponent(email)}&select=*&order=updated_at.desc&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Community role application query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as CommunityRoleApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getUserById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`User query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertFounderApplication(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/founder_applications`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            email: record.email,
            name: record.name,
            full_name: record.full_name ?? record.name,
            company_name: record.company_name ?? null,
            pitch_summary: record.pitch_summary ?? null,
            industry: record.industry ?? null,
            stage: record.stage ?? null,
            deck_file_id: record.deck_file_id ?? null,
            deck_path: record.deck_path ?? null,
            website: record.website ?? null,
            twitter: record.twitter ?? null,
            linkedin: record.linkedin ?? null,
            status: record.status ?? 'pending',
            assigned_event_id: record.assigned_event_id ?? null,
            application_data: record.application_data ?? {},
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertCommunityRoleApplication(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/community_role_applications`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            role: record.role,
            email: record.email,
            full_name: record.full_name,
            expertise: record.expertise,
            linkedin: record.linkedin ?? null,
            application_data: record.application_data ?? {},
            status: record.status ?? 'pending',
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Community role application insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as CommunityRoleApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateFounderApplication(id, updates) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_applications?id=eq.${encodeURIComponent(id)}`,
          {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(updates),
          }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder application update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderApplicationRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getUserByEmail(email) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`User query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertUser(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            id: record.id ?? undefined,
            email: record.email,
            name: record.name ?? null,
            unsubscribed: record.unsubscribed ?? false,
            unsubscribe_token: record.unsubscribe_token ?? randomUUID(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`User insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateUser(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`User update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFounderByUserId(userId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founders?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertFounder(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/founders`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: record.user_id,
            company_name: record.company_name ?? null,
            website: record.website ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Founder insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateFounder(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/founders?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Founder update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getRoleAssignmentsByUserId(userId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/role_assignments?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=100`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Role assignments query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RoleAssignmentRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listRoleAssignments() {
      try {
        const select = 'id,user_id,role,scope,scoped_id,created_at,updated_at,created_by,user:users!role_assignments_user_id_fkey(id,email,name),assigned_by_user:users!role_assignments_created_by_fkey(id,email,name)';
        const response = await fetch(
          `${supabaseUrl}/rest/v1/role_assignments?select=${encodeURIComponent(select)}&order=created_at.desc&limit=500`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Role assignments list failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RoleAssignmentListRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertRoleAssignment(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/role_assignments`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: record.user_id,
            role: record.role,
            scope: record.scope,
            scoped_id: record.scoped_id ?? null,
            created_by: record.created_by,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Role assignment insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RoleAssignmentRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteRoleAssignment(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/role_assignments?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
            headers: { ...headers, Prefer: 'return=representation' },
          }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Role assignment delete failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RoleAssignmentRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listEvents() {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/events?select=*&order=start_date.desc.nullslast,starts_at.desc.nullslast&limit=500`, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Events query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EventRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listEventsByIds(ids) {
      if (ids.length === 0) {
        return { data: [], error: null };
      }

      const encodedIds = ids.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/events?id=in.(${encodeURIComponent(encodedIds)})&select=*&order=start_date.desc.nullslast,starts_at.desc.nullslast`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Events query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EventRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getEventById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/events?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Event query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EventRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertEvent(record) {
      const startDate = record.start_date ?? record.starts_at;
      const endDate = record.end_date ?? record.ends_at;
      if (!startDate || !endDate) {
        return { data: null, error: new Error('Event insert requires start_date and end_date (or legacy starts_at/ends_at).') };
      }

      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/events`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            name: record.name,
            description: record.description ?? null,
            status: record.status ?? 'upcoming',
            start_date: startDate,
            end_date: endDate,
            scoring_start: record.scoring_start ?? null,
            scoring_end: record.scoring_end ?? null,
            publishing_start: record.publishing_start ?? null,
            publishing_end: record.publishing_end ?? null,
            archived_at: record.archived_at ?? null,
            config: record.config ?? {},
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Event insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EventRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateEvent(id, updates) {
      const {
        starts_at: legacyStartDate,
        ends_at: legacyEndDate,
        ...restUpdates
      } = updates;

      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...restUpdates,
            start_date: updates.start_date ?? legacyStartDate,
            end_date: updates.end_date ?? legacyEndDate,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Event update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EventRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listFounderPitchesByEventId(eventId) {
      const select = [
        '*',
        'founder:founders!founder_pitches_founder_id_fkey(',
        'id,company_name,',
        'user:users!founders_user_id_fkey(id,email,name)',
        ')',
      ].join('');

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_pitches?event_id=eq.${encodeURIComponent(eventId)}&select=${encodeURIComponent(select)}&order=pitch_order.asc.nullslast,created_at.asc`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Founder pitches query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as JudgeEventPitchRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listMentorIdsByEventId(eventId) {
      try {
        const eventScopedFilter = `and(scope.eq.event,scoped_id.eq.${encodeURIComponent(eventId)})`;
        const globalScopedFilter = 'scope.eq.global';
        const response = await fetch(
          `${supabaseUrl}/rest/v1/role_assignments?role=eq.mentor&or=(${eventScopedFilter},${globalScopedFilter})&select=user_id`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Mentor assignments query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as Array<{ user_id: string }>;
        const ids = Array.from(
          new Set(
            rows
              .map((row) => row.user_id)
              .filter((value): value is string => typeof value === 'string' && value.length > 0)
          )
        );
        return { data: ids, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listFounderIdsByEventId(eventId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_pitches?event_id=eq.${encodeURIComponent(eventId)}&select=founder_id`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Founder event assignments query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as Array<{ founder_id: string }>;
        const ids = Array.from(
          new Set(
            rows
              .map((row) => row.founder_id)
              .filter((value): value is string => typeof value === 'string' && value.length > 0)
          )
        );
        return { data: ids, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listRecentMentorPairs(mentorIds, founderIds, createdAfterIso) {
      if (mentorIds.length === 0 || founderIds.length === 0) {
        return { data: [], error: null };
      }

      const encodedMentorIds = mentorIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
      const encodedFounderIds = founderIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/mentor_matches?mentor_id=in.(${encodeURIComponent(encodedMentorIds)})&founder_id=in.(${encodeURIComponent(encodedFounderIds)})&created_at=gt.${encodeURIComponent(createdAfterIso)}&select=mentor_id,founder_id,created_at&limit=5000`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Mentor matches history query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as MentorMatchPairRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertMentorMatch(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/mentor_matches`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            mentor_id: record.mentor_id,
            founder_id: record.founder_id,
            event_id: record.event_id,
            mentor_status: record.mentor_status ?? 'pending',
            founder_status: record.founder_status ?? 'pending',
            mentor_accepted_at: record.mentor_accepted_at ?? null,
            founder_accepted_at: record.founder_accepted_at ?? null,
            declined_by: record.declined_by ?? null,
            notes: record.notes ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Mentor match insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as MentorMatchRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getMentorMatchById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/mentor_matches?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Mentor match query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as MentorMatchRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateMentorMatchById(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/mentor_matches?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Mentor match update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as MentorMatchRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteMentorMatchById(id) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/mentor_matches?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { ...headers, Prefer: 'return=representation' },
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Mentor match delete failed: ${response.statusText}`) };
        }
        const rows = await response.json() as MentorMatchRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getFounderPitchById(id) {
      const select = [
        '*',
        'founder:founders!founder_pitches_founder_id_fkey(',
        'id,company_name,tagline,bio,website,pitch_deck_url,',
        'user:users!founders_user_id_fkey(id,email,name)',
        ')',
      ].join('');

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/founder_pitches?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(select)}&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Founder pitch query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as JudgePitchDetailRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateFounderPitch(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/founder_pitches?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Founder pitch update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as FounderPitchRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getLatestRubricVersionByEventId(eventId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_versions?event_id=eq.${encodeURIComponent(eventId)}&select=*&order=version.desc&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric version query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getJudgeScoreByJudgeAndPitch(judgeId, founderPitchId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/judge_scores?judge_id=eq.${encodeURIComponent(judgeId)}&founder_pitch_id=eq.${encodeURIComponent(founderPitchId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Judge score query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as JudgeScoreRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertJudgeScore(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/judge_scores`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...record,
            comments: record.comments ?? null,
            category_scores: record.category_scores ?? {},
            total_score: record.total_score ?? null,
            state: record.state ?? 'draft',
            submitted_at: record.submitted_at ?? null,
            locked_at: record.locked_at ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Judge score insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as JudgeScoreRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateJudgeScore(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/judge_scores?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Judge score update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as JudgeScoreRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listSponsors() {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/sponsors?select=*&order=updated_at.desc&limit=500`, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Sponsors query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getSponsorById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/sponsors?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Sponsor query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertSponsor(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/sponsors`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            name: record.name,
            logo_url: record.logo_url ?? null,
            website_url: record.website_url ?? null,
            tier: record.tier,
            placement_scope: record.placement_scope,
            event_id: record.event_id ?? null,
            end_date: record.end_date ?? null,
            pricing_cents: record.pricing_cents,
            status: record.status ?? 'active',
            display_priority: record.display_priority ?? 0,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Sponsor insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateSponsor(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/sponsors?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Sponsor update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteSponsor(id) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/sponsors?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          return { error: new Error(`Sponsor delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async searchUsersByEmail(query, limit = 10) {
      const trimmed = query.trim();
      if (!trimmed) {
        return { data: [], error: null };
      }

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/users?email=ilike.*${encodeURIComponent(trimmed)}*&select=id,email,name&order=email.asc&limit=${Math.max(1, Math.min(limit, 50))}`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`User search failed: ${response.statusText}`) };
        }
        const rows = await response.json() as UserSearchRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listRubricTemplates() {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_templates?select=*&order=updated_at.desc`, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Rubric templates query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getRubricTemplateById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_templates?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric template query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertRubricTemplate(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_templates`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            name: record.name,
            description: record.description ?? null,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric template insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateRubricTemplate(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_templates?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric template update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricTemplateRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listRubricVersionsByTemplateId(templateId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_versions?rubric_template_id=eq.${encodeURIComponent(templateId)}&select=*&order=version.desc`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Rubric versions query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getLatestRubricVersionByTemplateId(templateId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rubric_versions?rubric_template_id=eq.${encodeURIComponent(templateId)}&select=*&order=version.desc&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric version query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertRubricVersion(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rubric_versions`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            rubric_template_id: record.rubric_template_id,
            version: record.version,
            event_id: record.event_id ?? null,
            definition: record.definition,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Rubric version insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as RubricVersionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listProducts(activeOnly = false) {
      try {
        const query = activeOnly
          ? `${supabaseUrl}/rest/v1/products?active=eq.true&select=*&order=name.asc`
          : `${supabaseUrl}/rest/v1/products?select=*&order=name.asc`;
        const response = await fetch(query, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Products query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as ProductRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getProductById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Product query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as ProductRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertProduct(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/products`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            name: record.name,
            description: record.description ?? null,
            stripe_product_id: record.stripe_product_id ?? null,
            product_type: record.product_type ?? 'subscription',
            access_type: record.access_type ?? null,
            file_id: record.file_id ?? null,
            file_path: record.file_path ?? null,
            sales_count: record.sales_count ?? 0,
            revenue_cents: record.revenue_cents ?? 0,
            status: record.status ?? 'active',
            active: record.active ?? true,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Product insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as ProductRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateProduct(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Product update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as ProductRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteProduct(id) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          return { error: new Error(`Product delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listPricesByProductId(productId, activeOnly = false) {
      try {
        const base = `${supabaseUrl}/rest/v1/prices?product_id=eq.${encodeURIComponent(productId)}&select=*&order=amount_cents.asc`;
        const response = await fetch(activeOnly ? `${base}&active=eq.true` : base, { headers });
        if (!response.ok) {
          return { data: [], error: new Error(`Prices query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as PriceRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getPriceById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/prices?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Price query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as PriceRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertPrice(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/prices`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            product_id: record.product_id,
            stripe_price_id: record.stripe_price_id ?? null,
            amount_cents: record.amount_cents,
            currency: record.currency ?? 'USD',
            billing_interval: record.billing_interval,
            active: record.active ?? true,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Price insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as PriceRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updatePrice(id, updates) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/prices?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Price update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as PriceRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deletePrice(id) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/prices?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          return { error: new Error(`Price delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getSubscriptionByStripeId(stripeSubscriptionId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/subscriptions?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Subscription query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SubscriptionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listSubscriptionsByUserId(userId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Subscriptions query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SubscriptionRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getSubscriptionById(subscriptionId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/subscriptions?id=eq.${encodeURIComponent(subscriptionId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Subscription query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SubscriptionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async requestSubscriptionCancellation(subscriptionId) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/subscriptions?id=eq.${encodeURIComponent(subscriptionId)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'cancelled',
            cancel_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Subscription cancellation failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SubscriptionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async upsertSubscription(record) {
      try {
        const payload = {
          id: record.id ?? undefined,
          user_id: record.user_id,
          stripe_subscription_id: record.stripe_subscription_id,
          stripe_customer_id: record.stripe_customer_id ?? null,
          price_id: record.price_id ?? null,
          status: record.status,
          current_period_start: record.current_period_start ?? null,
          current_period_end: record.current_period_end ?? null,
          cancel_at: record.cancel_at ?? null,
          updated_at: new Date().toISOString(),
        };
        const response = await fetch(`${supabaseUrl}/rest/v1/subscriptions?on_conflict=stripe_subscription_id`, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Subscription upsert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SubscriptionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getTransactionByStripeEventId(stripeEventId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/transactions?stripe_event_id=eq.${encodeURIComponent(stripeEventId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Transaction query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as TransactionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertTransaction(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: record.user_id ?? null,
            subscription_id: record.subscription_id ?? null,
            stripe_event_id: record.stripe_event_id,
            event_type: record.event_type,
            amount_cents: record.amount_cents ?? null,
            currency: record.currency ?? null,
            status: record.status,
            metadata: record.metadata ?? {},
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Transaction insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as TransactionRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listEntitlementsByUserId(userId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/entitlements?user_id=eq.${encodeURIComponent(userId)}&select=*&order=granted_at.desc`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Entitlements query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EntitlementRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertEntitlement(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/entitlements`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: record.user_id,
            product_id: record.product_id,
            granted_at: record.granted_at ?? new Date().toISOString(),
            expires_at: record.expires_at ?? null,
            source: record.source,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Entitlement insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as EntitlementRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getContentById(contentId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/content?id=eq.${encodeURIComponent(contentId)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Content query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as ContentRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async listSponsorshipTiersByFounderId(founderId) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/sponsorship_tiers?founder_id=eq.${encodeURIComponent(founderId)}&select=*&order=sort_order.asc`,
          { headers }
        );
        if (!response.ok) {
          return { data: [], error: new Error(`Sponsorship tiers query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorshipTierRecord[];
        return { data: rows, error: null };
      } catch (err) {
        return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async getSponsorshipTierById(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/sponsorship_tiers?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
          { headers }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Sponsorship tier query failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorshipTierRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async insertSponsorshipTier(record) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/sponsorship_tiers`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            founder_id: record.founder_id,
            label: record.label,
            amount_cents: record.amount_cents,
            perk_description: record.perk_description,
            sort_order: record.sort_order ?? 0,
            active: record.active ?? true,
          }),
        });
        if (!response.ok) {
          return { data: null, error: new Error(`Sponsorship tier insert failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorshipTierRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async updateSponsorshipTier(id, updates) {
      try {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.label !== undefined) payload.label = updates.label;
        if (updates.amount_cents !== undefined) payload.amount_cents = updates.amount_cents;
        if (updates.perk_description !== undefined) payload.perk_description = updates.perk_description;
        if (updates.sort_order !== undefined) payload.sort_order = updates.sort_order;
        if (updates.active !== undefined) payload.active = updates.active;

        const response = await fetch(
          `${supabaseUrl}/rest/v1/sponsorship_tiers?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { ...headers, Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          return { data: null, error: new Error(`Sponsorship tier update failed: ${response.statusText}`) };
        }
        const rows = await response.json() as SponsorshipTierRecord[];
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    async deleteSponsorshipTier(id) {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/sponsorship_tiers?id=eq.${encodeURIComponent(id)}`,
          { method: 'DELETE', headers }
        );
        if (!response.ok) {
          return { error: new Error(`Sponsorship tier delete failed: ${response.statusText}`) };
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
  };

  _client = { storage, db };
  return _client;
}

/** Override the Supabase client (for testing). */
export function setSupabaseClient(client: SupabaseClient): void {
  _client = client;
}

/** Reset the Supabase client to null (forces re-init on next call). */
export function resetSupabaseClient(): void {
  _client = null;
}
