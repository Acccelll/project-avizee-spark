DO $$
DECLARE r record;
  infra text[] := ARRAY[
    '_set_vault_secret','get_secret_gateway_key','get_secret_sefaz_password',
    'get_secret_smtp_password','get_secret_vault_by_name','set_secret_gateway_key',
    'set_secret_sefaz_password','set_secret_smtp_password','existe_secret_vault',
    'enqueue_email','read_email_batch','delete_email','move_to_dlq','touch_cron_health',
    'marcar_lancamentos_vencidos','expirar_orcamentos_vencidos',
    'backfill_nfe_distribuicao_destinatario','financeiro_backfill_importadas_pos_uso',
    'nfe_emissao_pendente_concluir','nfe_emissao_pendente_listar_proximo_lote',
    'sefaz_consulta_pode_disparar'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname,
           (p.prorettype = 'trigger'::regtype) AS is_trigger
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
  LOOP
    -- Remove o grant implicito herdado de PUBLIC (que mascarava os REVOKEs)
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    -- service_role (edge functions / cron) sempre pode executar
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);

    IF NOT r.is_trigger AND NOT (r.proname = ANY (infra)) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- Whitelist anonima: apenas o fluxo de orcamento publico por token
GRANT EXECUTE ON FUNCTION public.get_orcamento_publico(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.acao_cliente_orcamento(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO anon;