
-- Passo 1: novas colunas e índices em nfe_distribuicao
ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS tipo_documento text
    NOT NULL DEFAULT 'resNFe'
    CHECK (tipo_documento IN ('procNFe', 'resNFe', 'resEvento', 'procEventoNFe'));

ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS ciencia_automatica_at timestamptz;

ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS cancelamento_recebido_at timestamptz;

ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS cancelamento_protocolo text;

ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS nota_fiscal_id uuid
    REFERENCES public.notas_fiscais(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nfe_distribuicao_chave
  ON public.nfe_distribuicao (chave_acesso);

CREATE INDEX IF NOT EXISTS idx_nfe_distribuicao_manifestacao
  ON public.nfe_distribuicao (status_manifestacao)
  WHERE status_manifestacao = 'sem_manifestacao';

COMMENT ON COLUMN public.nfe_distribuicao.tipo_documento
  IS 'Schema retornado pelo DistDFe: procNFe (NF-e completa) | resNFe (resumo) | resEvento | procEventoNFe.';
COMMENT ON COLUMN public.nfe_distribuicao.ciencia_automatica_at
  IS 'Timestamp do envio automático do evento 210210 (Ciência) pelo cron process-distdfe-cron.';
COMMENT ON COLUMN public.nfe_distribuicao.cancelamento_recebido_at
  IS 'Preenchido quando um resEvento de cancelamento (tpEvento=110111) é recebido via DistDFe.';
COMMENT ON COLUMN public.nfe_distribuicao.cancelamento_protocolo
  IS 'Protocolo do evento de cancelamento recebido via DistDFe.';
COMMENT ON COLUMN public.nfe_distribuicao.nota_fiscal_id
  IS 'Vínculo com notas_fiscais após importação como NF-e de entrada.';

-- Passo 2: RPC importar_nfe_distribuicao_como_entrada
CREATE OR REPLACE FUNCTION public.importar_nfe_distribuicao_como_entrada(
  p_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dist        public.nfe_distribuicao%ROWTYPE;
  v_nf_id       uuid;
  v_empresa_id  uuid;
  v_emit_label  text;
BEGIN
  SELECT * INTO v_dist FROM public.nfe_distribuicao WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nfe_distribuicao % não encontrada.', p_id;
  END IF;

  IF v_dist.xml_nfe IS NULL THEN
    RAISE EXCEPTION 'XML da NF-e ainda não disponível (aguardar Ciência automática).';
  END IF;

  -- Idempotência: se já existe nota com a mesma chave, vincula e retorna
  SELECT id INTO v_nf_id
    FROM public.notas_fiscais
   WHERE chave_acesso = v_dist.chave_acesso
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.nfe_distribuicao
       SET xml_importado      = true,
           nota_fiscal_id     = v_nf_id,
           data_processamento = COALESCE(data_processamento, NOW()),
           updated_at         = NOW()
     WHERE id = p_id;
    RETURN v_nf_id;
  END IF;

  -- Empresa do usuário atual (fallback: primeira empresa ativa)
  SELECT empresa_id INTO v_empresa_id
    FROM public.user_empresas
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id
      FROM public.empresas
     WHERE ativo IS TRUE
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa configurada para importar a NF-e.';
  END IF;

  v_emit_label := COALESCE(v_dist.nome_emitente, 'CNPJ ' || COALESCE(v_dist.cnpj_emitente, '—'));

  INSERT INTO public.notas_fiscais (
    empresa_id,
    tipo,
    tipo_documento,
    modelo_documento,
    chave_acesso,
    numero,
    serie,
    data_emissao,
    valor_total,
    status,
    status_sefaz,
    protocolo_autorizacao,
    natureza_operacao,
    origem,
    observacoes,
    usuario_criacao_id
  ) VALUES (
    v_empresa_id,
    'entrada',
    'nfe',
    '55',
    v_dist.chave_acesso,
    v_dist.numero,
    v_dist.serie,
    v_dist.data_emissao::date,
    v_dist.valor_total,
    'importada',
    'autorizada',
    v_dist.protocolo_autorizacao,
    v_dist.natureza_operacao,
    'distdfe',
    'Importada via DistDFe. Emitente: ' || v_emit_label
      || COALESCE(' · CNPJ ' || v_dist.cnpj_emitente, '')
      || COALESCE(' · UF ' || v_dist.uf_emitente, ''),
    auth.uid()
  )
  RETURNING id INTO v_nf_id;

  UPDATE public.nfe_distribuicao
     SET xml_importado      = true,
         nota_fiscal_id     = v_nf_id,
         data_processamento = NOW(),
         updated_at         = NOW()
   WHERE id = p_id;

  RETURN v_nf_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.importar_nfe_distribuicao_como_entrada(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.importar_nfe_distribuicao_como_entrada(uuid)
  IS 'Cria notas_fiscais (tipo=entrada, modelo=55) a partir de nfe_distribuicao capturada pelo DistDFe. Idempotente por chave_acesso.';
