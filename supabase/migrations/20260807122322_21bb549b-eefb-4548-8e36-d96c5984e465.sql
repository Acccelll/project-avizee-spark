-- ============================================================
-- 1. cliente_registros_comunicacao — escopo por empresa
-- ============================================================
DROP POLICY IF EXISTS crc_select ON public.cliente_registros_comunicacao;
DROP POLICY IF EXISTS crc_insert_role ON public.cliente_registros_comunicacao;
DROP POLICY IF EXISTS crc_update_role ON public.cliente_registros_comunicacao;
DROP POLICY IF EXISTS crc_delete_role ON public.cliente_registros_comunicacao;

CREATE POLICY crc_select ON public.cliente_registros_comunicacao
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'financeiro'))
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_registros_comunicacao.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY crc_insert_role ON public.cliente_registros_comunicacao
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_registros_comunicacao.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY crc_update_role ON public.cliente_registros_comunicacao
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_registros_comunicacao.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_registros_comunicacao.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY crc_delete_role ON public.cliente_registros_comunicacao
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_registros_comunicacao.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

COMMENT ON TABLE public.cliente_registros_comunicacao IS
  'Multi-tenant via clientes.empresa_id (sem coluna propria). RLS: admin total; vendedor/financeiro somente clientes da empresa corrente.';

-- ============================================================
-- 2. clientes_enderecos_entrega — escopo por empresa
-- ============================================================
DROP POLICY IF EXISTS cee_select ON public.clientes_enderecos_entrega;
DROP POLICY IF EXISTS cee_insert_role ON public.clientes_enderecos_entrega;
DROP POLICY IF EXISTS cee_update_role ON public.clientes_enderecos_entrega;
DROP POLICY IF EXISTS cee_delete_role ON public.clientes_enderecos_entrega;

CREATE POLICY cee_select ON public.clientes_enderecos_entrega
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'financeiro'))
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = clientes_enderecos_entrega.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY cee_insert_role ON public.clientes_enderecos_entrega
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = clientes_enderecos_entrega.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY cee_update_role ON public.clientes_enderecos_entrega
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = clientes_enderecos_entrega.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = clientes_enderecos_entrega.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY cee_delete_role ON public.clientes_enderecos_entrega
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = clientes_enderecos_entrega.cliente_id
        AND c.empresa_id = public.current_empresa_id()
    )
  )
);

COMMENT ON TABLE public.clientes_enderecos_entrega IS
  'Multi-tenant via clientes.empresa_id. RLS: admin total; vendedor/financeiro somente clientes da empresa corrente.';

-- ============================================================
-- 3. produtos_fornecedores — remove USING(true), escopo por empresa
-- ============================================================
DROP POLICY IF EXISTS pf_select ON public.produtos_fornecedores;
DROP POLICY IF EXISTS pf_insert_role ON public.produtos_fornecedores;
DROP POLICY IF EXISTS pf_update_role ON public.produtos_fornecedores;
DROP POLICY IF EXISTS pf_delete_role ON public.produtos_fornecedores;

CREATE POLICY pf_select ON public.produtos_fornecedores
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produtos_fornecedores.produto_id
      AND p.empresa_id = public.current_empresa_id()
  )
);

CREATE POLICY pf_insert_role ON public.produtos_fornecedores
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor_compras')
    AND EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produtos_fornecedores.produto_id
        AND p.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY pf_update_role ON public.produtos_fornecedores
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor_compras')
    AND EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produtos_fornecedores.produto_id
        AND p.empresa_id = public.current_empresa_id()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor_compras')
    AND EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produtos_fornecedores.produto_id
        AND p.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY pf_delete_role ON public.produtos_fornecedores
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor_compras')
    AND EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produtos_fornecedores.produto_id
        AND p.empresa_id = public.current_empresa_id()
    )
  )
);

COMMENT ON TABLE public.produtos_fornecedores IS
  'Multi-tenant via produtos.empresa_id. Precos de compra nunca visiveis fora da empresa do produto.';

-- ============================================================
-- 4. Storage: danfe-pdfs (path = <nota_fiscal_id>/arquivo.pdf)
-- ============================================================
DROP POLICY IF EXISTS danfe_pdfs_select_auth ON storage.objects;
DROP POLICY IF EXISTS danfe_pdfs_insert_auth ON storage.objects;

CREATE POLICY danfe_pdfs_select_auth ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'danfe-pdfs'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.id::text = (storage.foldername(name))[1]
        AND nf.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY danfe_pdfs_insert_auth ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'danfe-pdfs'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'))
  AND EXISTS (
    SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id::text = (storage.foldername(name))[1]
      AND (nf.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY danfe_pdfs_update_auth ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'danfe-pdfs'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.id::text = (storage.foldername(name))[1]
        AND nf.empresa_id = public.current_empresa_id()
    )
  )
);

-- ============================================================
-- 5. Storage: orcamentos-pdf (path = <orcamento_id>/arquivo.pdf)
-- ============================================================
DROP POLICY IF EXISTS "Auth users can read orcamento PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update orcamento PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload orcamento PDFs" ON storage.objects;

CREATE POLICY orcamentos_pdf_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'orcamentos-pdf'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND o.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY orcamentos_pdf_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'orcamentos-pdf'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'financeiro'))
      AND EXISTS (
        SELECT 1 FROM public.orcamentos o
        WHERE o.id::text = (storage.foldername(name))[1]
          AND o.empresa_id = public.current_empresa_id()
      )
    )
  )
);

CREATE POLICY orcamentos_pdf_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'orcamentos-pdf'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND o.empresa_id = public.current_empresa_id()
    )
  )
);

CREATE POLICY orcamentos_pdf_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'orcamentos-pdf'
  AND public.has_role(auth.uid(), 'admin')
);

-- ============================================================
-- 6. Storage: email-assets — leitura publica (necessaria para
--    clientes de e-mail) porem escrita restrita a admin
-- ============================================================
DROP POLICY IF EXISTS email_assets_write_admin ON storage.objects;
CREATE POLICY email_assets_write_admin ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS email_assets_update_admin ON storage.objects;
CREATE POLICY email_assets_update_admin ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS email_assets_delete_admin ON storage.objects;
CREATE POLICY email_assets_delete_admin ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 7. SECURITY DEFINER functions — least privilege
-- ============================================================

-- 7a. Funcoes de trigger nunca precisam de EXECUTE para roles da API.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 7b. Nenhum visitante anonimo deve executar funcoes SECURITY DEFINER,
--     exceto as necessarias ao fluxo de orcamento publico por token.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- Whitelist anonima (tela /orcamento-publico) + helpers usados dentro de
-- politicas RLS avaliadas em contexto anonimo.
GRANT EXECUTE ON FUNCTION public.get_orcamento_publico(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.acao_cliente_orcamento(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO anon;

-- 7c. Funcoes de infraestrutura interna: apenas service_role (edges/cron).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND p.proname IN (
        '_set_vault_secret',
        'get_secret_gateway_key',
        'get_secret_sefaz_password',
        'get_secret_smtp_password',
        'get_secret_vault_by_name',
        'set_secret_gateway_key',
        'set_secret_sefaz_password',
        'set_secret_smtp_password',
        'existe_secret_vault',
        'enqueue_email',
        'read_email_batch',
        'delete_email',
        'move_to_dlq',
        'touch_cron_health',
        'marcar_lancamentos_vencidos',
        'expirar_orcamentos_vencidos',
        'backfill_nfe_distribuicao_destinatario',
        'financeiro_backfill_importadas_pos_uso',
        'nfe_emissao_pendente_concluir',
        'nfe_emissao_pendente_listar_proximo_lote',
        'sefaz_consulta_pode_disparar'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;