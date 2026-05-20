CREATE INDEX IF NOT EXISTS idx_notas_fiscais_com_xml
  ON public.notas_fiscais (chave_acesso)
  WHERE caminho_xml IS NOT NULL;