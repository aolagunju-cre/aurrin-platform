-- Public role application intake for judge and mentor submissions.
-- Extends the public apply surface without changing founder intake storage.

CREATE TYPE community_role AS ENUM ('judge', 'mentor');
CREATE TYPE community_role_application_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE community_role_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role community_role NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  expertise TEXT NOT NULL,
  linkedin TEXT,
  application_data JSONB NOT NULL DEFAULT '{}',
  status community_role_application_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_community_role_applications_role_email
  ON community_role_applications(role, email);

CREATE INDEX idx_community_role_applications_status
  ON community_role_applications(status);

CREATE TRIGGER community_role_applications_update_timestamp
BEFORE UPDATE ON community_role_applications
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

ALTER TABLE community_role_applications ENABLE ROW LEVEL SECURITY;
