-- Migration 004: Files table RLS policies (storage access control)
-- Applied after 003_rls_policies.sql which already enables RLS on files.
-- These policies enforce row-level access: file owners see their own files,
-- admins see all files.

-- Re-enable RLS (idempotent)
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies from earlier migrations before recreating
DROP POLICY IF EXISTS "files_select_own" ON files;
DROP POLICY IF EXISTS "files_select_public" ON files;
DROP POLICY IF EXISTS "files_select_admin" ON files;
DROP POLICY IF EXISTS "files_insert_authenticated" ON files;
DROP POLICY IF EXISTS "files_delete_own" ON files;
DROP POLICY IF EXISTS "files_delete_admin" ON files;
DROP POLICY IF EXISTS "files_update_own" ON files;

-- SELECT: users see their own files
CREATE POLICY "files_select_own" ON files
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- SELECT: public files are visible to everyone (e.g. published social assets)
CREATE POLICY "files_select_public" ON files
  FOR SELECT
  USING (is_public = TRUE);

-- SELECT: admins see all files
CREATE POLICY "files_select_admin" ON files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM role_assignments ra
      WHERE ra.user_id = auth.uid()
        AND ra.role = 'Admin'
        AND ra.scope = 'global'
    )
  );

-- INSERT: authenticated users may upload files they own
CREATE POLICY "files_insert_authenticated" ON files
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- UPDATE: users may update metadata for their own files
CREATE POLICY "files_update_own" ON files
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- DELETE: users may delete their own files
CREATE POLICY "files_delete_own" ON files
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- DELETE: admins may delete any file
CREATE POLICY "files_delete_admin" ON files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM role_assignments ra
      WHERE ra.user_id = auth.uid()
        AND ra.role = 'Admin'
        AND ra.scope = 'global'
    )
  );

-- Rollback note: to revert run rollback_004.sql
