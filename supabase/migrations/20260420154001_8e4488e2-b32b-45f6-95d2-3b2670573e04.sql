
-- ============================================================================
-- REVISÃO ESTRUTURAL DO MÓDULO DE CADASTROS
-- Consolida: formas_pagamento (clientes+financeiro), grupos_econ, documentos
-- únicos, soft-delete, FKs de integridade. Tudo idempotente.
-- ============================================================================

-- ─── 0. Tabela de pendências de migração ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cadastros_pendencias_migracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid,
  campo text,
  valor_origem text,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cadastros_pendencias_migracao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cpm_select ON public.cadastros_pendencias_migracao
    FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cpm_insert ON public.cadastros_pendencias_migracao
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── B1. Clientes × Formas de Pagamento ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_formas_pagamento_descricao_lower
  ON public.formas_pagamento (lower(trim(descricao)));

-- Backfill match único
WITH matches AS (
  SELECT c.id AS cliente_id,
         (SELECT fp.id FROM public.formas_pagamento fp
          WHERE lower(trim(fp.descricao)) = lower(trim(c.forma_pagamento_padrao))
          LIMIT 2) AS fp_first,
         (SELECT count(*) FROM public.formas_pagamento fp
          WHERE lower(trim(fp.descricao)) = lower(trim(c.forma_pagamento_padrao))) AS cnt
  FROM public.clientes c
  WHERE c.forma_pagamento_id IS NULL
    AND c.forma_pagamento_padrao IS NOT NULL
    AND trim(c.forma_pagamento_padrao) <> ''
)
UPDATE public.clientes c
   SET forma_pagamento_id = m.fp_first
  FROM matches m
 WHERE c.id = m.cliente_id AND m.cnt = 1;

-- Registrar pendências (sem_match / ambiguo)
INSERT INTO public.cadastros_pendencias_migracao (entidade, entidade_id, campo, valor_origem, motivo)
SELECT 'clientes', c.id, 'forma_pagamento_padrao', c.forma_pagamento_padrao,
  CASE WHEN (SELECT count(*) FROM public.formas_pagamento fp
             WHERE lower(trim(fp.descricao)) = lower(trim(c.forma_pagamento_padrao))) = 0
       THEN 'sem_match' ELSE 'ambiguo' END
FROM public.clientes c
WHERE c.forma_pagamento_id IS NULL
  AND c.forma_pagamento_padrao IS NOT NULL
  AND trim(c.forma_pagamento_padrao) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.cadastros_pendencias_migracao p
    WHERE p.entidade = 'clientes' AND p.entidade_id = c.id AND p.campo = 'forma_pagamento_padrao'
  );

-- FK clientes.forma_pagamento_id → formas_pagamento
DO $$ BEGIN
  ALTER TABLE public.clientes
    ADD CONSTRAINT clientes_forma_pagamento_id_fkey
    FOREIGN KEY (forma_pagamento_id) REFERENCES public.formas_pagamento(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ix_clientes_forma_pagamento_id ON public.clientes(forma_pagamento_id);

COMMENT ON COLUMN public.clientes.forma_pagamento_padrao
  IS 'DEPRECATED: usar forma_pagamento_id (referência para formas_pagamento.id)';

-- ─── B2. Semântica de Formas de Pagamento ───────────────────────────────────
-- Normaliza tipos atuais para o vocabulário oficial
UPDATE public.formas_pagamento SET tipo = lower(trim(tipo)) WHERE tipo IS NOT NULL;
UPDATE public.formas_pagamento SET tipo = 'outro'
  WHERE tipo IS NULL OR tipo NOT IN ('pix','boleto','cartao','dinheiro','transferencia','outro');

DO $$ BEGIN
  ALTER TABLE public.formas_pagamento
    ADD CONSTRAINT chk_forma_pagamento_tipo
    CHECK (tipo IN ('pix','boleto','cartao','dinheiro','transferencia','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- financeiro_lancamentos.forma_pagamento_id (paralela ao texto legado)
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid;

DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_forma_pagamento_id_fkey
    FOREIGN KEY (forma_pagamento_id) REFERENCES public.formas_pagamento(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ix_financeiro_lancamentos_forma_pagamento_id
  ON public.financeiro_lancamentos(forma_pagamento_id);

UPDATE public.financeiro_lancamentos f
   SET forma_pagamento_id = fp.id
  FROM public.formas_pagamento fp
 WHERE f.forma_pagamento_id IS NULL
   AND f.forma_pagamento IS NOT NULL
   AND lower(trim(f.forma_pagamento)) = lower(trim(fp.descricao));

-- ─── B3. Grupos Econômicos → Clientes (matriz) ──────────────────────────────
-- Órfãos de empresa_matriz_id → pendência + NULL
INSERT INTO public.cadastros_pendencias_migracao (entidade, entidade_id, campo, valor_origem, motivo)
SELECT 'grupos_economicos', g.id, 'empresa_matriz_id', g.empresa_matriz_id::text, 'matriz_orfa'
  FROM public.grupos_economicos g
 WHERE g.empresa_matriz_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = g.empresa_matriz_id)
   AND NOT EXISTS (
     SELECT 1 FROM public.cadastros_pendencias_migracao p
     WHERE p.entidade='grupos_economicos' AND p.entidade_id=g.id AND p.motivo='matriz_orfa'
   );

UPDATE public.grupos_economicos g SET empresa_matriz_id = NULL
 WHERE g.empresa_matriz_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = g.empresa_matriz_id);

DO $$ BEGIN
  ALTER TABLE public.grupos_economicos
    ADD CONSTRAINT grupos_economicos_matriz_fkey
    FOREIGN KEY (empresa_matriz_id) REFERENCES public.clientes(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ix_grupos_economicos_matriz ON public.grupos_economicos(empresa_matriz_id);

-- clientes.grupo_economico_id → grupos_economicos
INSERT INTO public.cadastros_pendencias_migracao (entidade, entidade_id, campo, valor_origem, motivo)
SELECT 'clientes', c.id, 'grupo_economico_id', c.grupo_economico_id::text, 'grupo_orfao'
  FROM public.clientes c
 WHERE c.grupo_economico_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.grupos_economicos g WHERE g.id = c.grupo_economico_id)
   AND NOT EXISTS (
     SELECT 1 FROM public.cadastros_pendencias_migracao p
     WHERE p.entidade='clientes' AND p.entidade_id=c.id AND p.motivo='grupo_orfao'
   );

UPDATE public.clientes SET grupo_economico_id = NULL
 WHERE grupo_economico_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.grupos_economicos g WHERE g.id = clientes.grupo_economico_id);

DO $$ BEGIN
  ALTER TABLE public.clientes
    ADD CONSTRAINT clientes_grupo_economico_id_fkey
    FOREIGN KEY (grupo_economico_id) REFERENCES public.grupos_economicos(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ix_clientes_grupo_economico_id ON public.clientes(grupo_economico_id);

-- ─── B4. Documentos únicos (CPF/CNPJ) ───────────────────────────────────────
-- Normalização
UPDATE public.clientes        SET cpf_cnpj = regexp_replace(cpf_cnpj, '\D', '', 'g') WHERE cpf_cnpj ~ '\D';
UPDATE public.fornecedores    SET cpf_cnpj = regexp_replace(cpf_cnpj, '\D', '', 'g') WHERE cpf_cnpj ~ '\D';
UPDATE public.transportadoras SET cpf_cnpj = regexp_replace(cpf_cnpj, '\D', '', 'g') WHERE cpf_cnpj ~ '\D';
UPDATE public.funcionarios    SET cpf      = regexp_replace(cpf, '\D', '', 'g')      WHERE cpf ~ '\D';

-- Trigger de normalização
CREATE OR REPLACE FUNCTION public.trg_normaliza_documento()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'funcionarios' THEN
    IF NEW.cpf IS NOT NULL THEN NEW.cpf := regexp_replace(NEW.cpf, '\D', '', 'g'); END IF;
  ELSE
    IF NEW.cpf_cnpj IS NOT NULL THEN NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj, '\D', '', 'g'); END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clientes_normaliza_doc BEFORE INSERT OR UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.trg_normaliza_documento();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_fornecedores_normaliza_doc BEFORE INSERT OR UPDATE ON public.fornecedores
    FOR EACH ROW EXECUTE FUNCTION public.trg_normaliza_documento();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_transportadoras_normaliza_doc BEFORE INSERT OR UPDATE ON public.transportadoras
    FOR EACH ROW EXECUTE FUNCTION public.trg_normaliza_documento();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_funcionarios_normaliza_doc BEFORE INSERT OR UPDATE ON public.funcionarios
    FOR EACH ROW EXECUTE FUNCTION public.trg_normaliza_documento();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Duplicatas ativas → pendência
INSERT INTO public.cadastros_pendencias_migracao (entidade, entidade_id, campo, valor_origem, motivo)
SELECT 'clientes', c.id, 'cpf_cnpj', c.cpf_cnpj, 'documento_duplicado'
  FROM public.clientes c
 WHERE c.ativo = true AND c.cpf_cnpj IS NOT NULL AND c.cpf_cnpj <> ''
   AND EXISTS (SELECT 1 FROM public.clientes c2
               WHERE c2.id <> c.id AND c2.ativo = true AND c2.cpf_cnpj = c.cpf_cnpj)
   AND NOT EXISTS (
     SELECT 1 FROM public.cadastros_pendencias_migracao p
     WHERE p.entidade='clientes' AND p.entidade_id=c.id AND p.motivo='documento_duplicado'
   );

INSERT INTO public.cadastros_pendencias_migracao (entidade, entidade_id, campo, valor_origem, motivo)
SELECT 'fornecedores', f.id, 'cpf_cnpj', f.cpf_cnpj, 'documento_duplicado'
  FROM public.fornecedores f
 WHERE f.ativo = true AND f.cpf_cnpj IS NOT NULL AND f.cpf_cnpj <> ''
   AND EXISTS (SELECT 1 FROM public.fornecedores f2
               WHERE f2.id <> f.id AND f2.ativo = true AND f2.cpf_cnpj = f.cpf_cnpj)
   AND NOT EXISTS (
     SELECT 1 FROM public.cadastros_pendencias_migracao p
     WHERE p.entidade='fornecedores' AND p.entidade_id=f.id AND p.motivo='documento_duplicado'
   );

-- Índices parciais únicos (só quando NÃO há duplicatas ativas)
DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT cpf_cnpj FROM public.clientes WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> ''
    GROUP BY cpf_cnpj HAVING count(*) > 1
  ) x;
  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_cpf_cnpj_ativo
      ON public.clientes (cpf_cnpj) WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';
  END IF;
END $$;

DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT cpf_cnpj FROM public.fornecedores WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> ''
    GROUP BY cpf_cnpj HAVING count(*) > 1
  ) x;
  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_fornecedores_cpf_cnpj_ativo
      ON public.fornecedores (cpf_cnpj) WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';
  END IF;
END $$;

DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT cpf_cnpj FROM public.transportadoras WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> ''
    GROUP BY cpf_cnpj HAVING count(*) > 1
  ) x;
  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_transportadoras_cpf_cnpj_ativo
      ON public.transportadoras (cpf_cnpj) WHERE ativo = true AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';
  END IF;
END $$;

DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT cpf FROM public.funcionarios WHERE ativo = true AND cpf IS NOT NULL AND cpf <> ''
    GROUP BY cpf HAVING count(*) > 1
  ) x;
  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_funcionarios_cpf_ativo
      ON public.funcionarios (cpf) WHERE ativo = true AND cpf IS NOT NULL AND cpf <> '';
  END IF;
END $$;

-- ─── B5. Política de soft-delete (auditoria) ────────────────────────────────
ALTER TABLE public.clientes        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.clientes        ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.clientes        ADD COLUMN IF NOT EXISTS motivo_inativacao text;
ALTER TABLE public.fornecedores    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.fornecedores    ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.fornecedores    ADD COLUMN IF NOT EXISTS motivo_inativacao text;
ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS motivo_inativacao text;
ALTER TABLE public.produtos        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.produtos        ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.produtos        ADD COLUMN IF NOT EXISTS motivo_inativacao text;
ALTER TABLE public.funcionarios    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.funcionarios    ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.funcionarios    ADD COLUMN IF NOT EXISTS motivo_inativacao text;

CREATE OR REPLACE FUNCTION public.trg_registrar_inativacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false THEN
    IF NEW.deleted_at IS NULL THEN NEW.deleted_at := now(); END IF;
    IF NEW.deleted_by IS NULL THEN NEW.deleted_by := auth.uid(); END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.ativo = false AND NEW.ativo = true THEN
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
    NEW.motivo_inativacao := NULL;
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clientes_inativacao BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.trg_registrar_inativacao();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_fornecedores_inativacao BEFORE UPDATE ON public.fornecedores
    FOR EACH ROW EXECUTE FUNCTION public.trg_registrar_inativacao();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_transportadoras_inativacao BEFORE UPDATE ON public.transportadoras
    FOR EACH ROW EXECUTE FUNCTION public.trg_registrar_inativacao();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_produtos_inativacao BEFORE UPDATE ON public.produtos
    FOR EACH ROW EXECUTE FUNCTION public.trg_registrar_inativacao();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_funcionarios_inativacao BEFORE UPDATE ON public.funcionarios
    FOR EACH ROW EXECUTE FUNCTION public.trg_registrar_inativacao();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── B6. FKs de integridade faltantes ───────────────────────────────────────
-- cliente_transportadoras
DELETE FROM public.cliente_transportadoras ct
 WHERE NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = ct.cliente_id)
    OR NOT EXISTS (SELECT 1 FROM public.transportadoras t WHERE t.id = ct.transportadora_id);
DO $$ BEGIN
  ALTER TABLE public.cliente_transportadoras
    ADD CONSTRAINT cliente_transportadoras_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cliente_transportadoras
    ADD CONSTRAINT cliente_transportadoras_transportadora_id_fkey
    FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- clientes_enderecos_entrega
DELETE FROM public.clientes_enderecos_entrega cee
 WHERE NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cee.cliente_id);
DO $$ BEGIN
  ALTER TABLE public.clientes_enderecos_entrega
    ADD CONSTRAINT clientes_enderecos_entrega_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- cliente_registros_comunicacao
DELETE FROM public.cliente_registros_comunicacao crc
 WHERE NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = crc.cliente_id);
DO $$ BEGIN
  ALTER TABLE public.cliente_registros_comunicacao
    ADD CONSTRAINT cliente_registros_comunicacao_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- financeiro_lancamentos → normalizar órfãos para NULL, depois FK RESTRICT
INSERT INTO public.cadastros_pendencias_migracao (entidade, entidade_id, campo, valor_origem, motivo)
SELECT 'financeiro_lancamentos', f.id, 'cliente_id', f.cliente_id::text, 'cliente_orfao'
  FROM public.financeiro_lancamentos f
 WHERE f.cliente_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = f.cliente_id)
   AND NOT EXISTS (SELECT 1 FROM public.cadastros_pendencias_migracao p
                    WHERE p.entidade='financeiro_lancamentos' AND p.entidade_id=f.id AND p.motivo='cliente_orfao');
UPDATE public.financeiro_lancamentos SET cliente_id = NULL
 WHERE cliente_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = financeiro_lancamentos.cliente_id);

UPDATE public.financeiro_lancamentos SET fornecedor_id = NULL
 WHERE fornecedor_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = financeiro_lancamentos.fornecedor_id);

UPDATE public.financeiro_lancamentos SET conta_contabil_id = NULL
 WHERE conta_contabil_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.contas_contabeis cc WHERE cc.id = financeiro_lancamentos.conta_contabil_id);

UPDATE public.financeiro_lancamentos SET conta_bancaria_id = NULL
 WHERE conta_bancaria_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.contas_bancarias cb WHERE cb.id = financeiro_lancamentos.conta_bancaria_id);

DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_fornecedor_id_fkey
    FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_conta_contabil_id_fkey
    FOREIGN KEY (conta_contabil_id) REFERENCES public.contas_contabeis(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos
    ADD CONSTRAINT financeiro_lancamentos_conta_bancaria_id_fkey
    FOREIGN KEY (conta_bancaria_id) REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
