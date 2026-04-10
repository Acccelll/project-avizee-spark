
UPDATE storage.buckets SET public = false WHERE id = 'dbavizee';

DROP POLICY IF EXISTS "dbavizee_public_read" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_auth_delete" ON storage.objects;

CREATE POLICY "dbavizee_auth_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'dbavizee');
CREATE POLICY "dbavizee_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dbavizee');
CREATE POLICY "dbavizee_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'dbavizee');
CREATE POLICY "dbavizee_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'dbavizee');
