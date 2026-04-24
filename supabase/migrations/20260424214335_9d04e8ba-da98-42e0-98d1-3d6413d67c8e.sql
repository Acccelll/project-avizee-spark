
-- Bucket privado para PDFs gerados de orçamentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('orcamentos-pdf', 'orcamentos-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- Usuários autenticados podem fazer upload
CREATE POLICY "Auth users can upload orcamento PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'orcamentos-pdf');

-- Usuários autenticados podem ler/baixar
CREATE POLICY "Auth users can read orcamento PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'orcamentos-pdf');

-- Usuários autenticados podem atualizar (substituir PDFs)
CREATE POLICY "Auth users can update orcamento PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'orcamentos-pdf');
