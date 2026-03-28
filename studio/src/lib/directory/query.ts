export const PUBLIC_DIRECTORY_PITCH_SELECT = [
  'id,public_profile_slug,score_aggregate,pitch_deck_url,validation_summary,',
  'founder:founders!founder_pitches_founder_id_fkey(',
  'id,company_name,bio,website,social_proof,',
  'user:users!founders_user_id_fkey(name,email,avatar_url)',
  '),',
  'event:events!founder_pitches_event_id_fkey(id,name,status,starts_at,ends_at)',
].join('');
