-- Bucket privado para guardar os DANFEs PDF gerados após autorização
INSERT INTO storage.buckets (id, name, public)
VALUES ('danfe-pdfs', 'danfe-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Upload por usuários autenticados
DROP POLICY IF EXISTS "danfe_pdfs_insert_auth" ON storage.objects;
CREATE POLICY "danfe_pdfs_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'danfe-pdfs');

-- Leitura por usuários autenticados (necessário para signed URLs)
DROP POLICY IF EXISTS "danfe_pdfs_select_auth" ON storage.objects;
CREATE POLICY "danfe_pdfs_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'danfe-pdfs');

-- Exclusão restrita a admins
DROP POLICY IF EXISTS "danfe_pdfs_delete_admin" ON storage.objects;
CREATE POLICY "danfe_pdfs_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'danfe-pdfs' AND public.has_role(auth.uid(), 'admin'));