-- Workbook de Fechamento: entradas manuais de caixa e bloqueado.
--
-- 1. Bloqueado passa a ser só informado no fechamento (métrica 'bloqueado' em
--    workbook_valores_mensais). Antes era a soma atual dos limites dos cartões,
--    repetida em todos os meses; sem valor informado, o mês fica com 0.
-- 2. Caixa final (métrica 'caixa_final'): saldo real do extrato no fim do mês.
--    Não substitui receitas e despesas: a diferença para o caixa calculado vira
--    'ajuste_caixa' do mês (coluna AO da BASE), somado ao caixa acumulado do
--    modelo. Os meses seguintes partem do caixa informado. Um caixa informado
--    antes da janela do Workbook também vale como ponto de partida do saldo
--    anterior.
-- 3. O saldo anterior agora inclui dez/(ano-3): o caixa do modelo começa em
--    jan/(ano-2) e o resultado de dezembro ficava de fora.
--
-- Cada mês fechado devolve também 'caixa_final_calculado' (antes do ajuste do
-- mês) e 'caixa_final' (após), exibidos na janela "Entradas do fechamento".
CREATE OR REPLACE FUNCTION public.workbook_fechamento_dados(p_competencia text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_emp uuid := current_empresa_id();
  v_comp date;
  v_ano int;
  v_ini date;
  v_corte date;
  v_desde date := '1900-01-01';
  v_mes date;
  v_fim date;
  v_meses jsonb := '[]'::jsonb;
  v_val jsonb;
  v_fonte jsonb;
  v_soc jsonb;
  v_aging jsonb;
  v_est jsonb;
  v_rec numeric; v_desp numeric;
  v_lucro_ytd numeric := 0;
  v_saldo_ant numeric := 0;
  v_caixa numeric;
  v_ajuste numeric;
  v_cf_comp text;
  v_cf_valor numeric;
  r record;
  s record;
  k text;
  v_faixas text[] := ARRAY['av_0_30','av_31_60','av_61_90','av_90p','vc_0_30','vc_31_60','vc_61_90',
                           'vc_91_120','vc_121_180','vc_181_360','vc_360p'];
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não identificada.' USING ERRCODE = '42501';
  END IF;
  IF p_competencia !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida: % (use AAAA-MM)', p_competencia USING ERRCODE = '22023';
  END IF;
  v_comp := (p_competencia || '-01')::date;
  v_ano := extract(year FROM v_comp)::int;
  v_ini := make_date(v_ano - 3, 12, 1);
  -- O caixa do modelo começa em jan/(ano-2): o saldo anterior vai até dez/(ano-3).
  v_corte := make_date(v_ano - 2, 1, 1);

  -- Último caixa final informado antes da janela: o saldo parte dele.
  SELECT competencia, valor INTO v_cf_comp, v_cf_valor
    FROM workbook_valores_mensais
   WHERE empresa_id = v_emp AND metrica = 'caixa_final' AND chave = ''
     AND competencia < to_char(v_ini, 'YYYY-MM')
   ORDER BY competencia DESC
   LIMIT 1;
  IF v_cf_comp IS NOT NULL THEN
    v_desde := ((v_cf_comp || '-01')::date + interval '1 month')::date;
  END IF;

  SELECT coalesce(v_cf_valor, 0) + coalesce(sum(CASE WHEN metrica = 'receita_caixa' THEN valor ELSE -valor END), 0)
    INTO v_saldo_ant
    FROM workbook_valores_mensais
   WHERE empresa_id = v_emp AND metrica IN ('receita_caixa', 'despesa_caixa') AND chave = ''
     AND competencia >= to_char(v_desde, 'YYYY-MM')
     AND competencia < to_char(v_corte, 'YYYY-MM');
  v_saldo_ant := v_saldo_ant
    + _wb_caixa(v_emp, 'receber', v_desde, v_corte - 1)
    - _wb_caixa(v_emp, 'pagar', v_desde, v_corte - 1);
  v_caixa := v_saldo_ant;

  FOR r IN SELECT generate_series(v_ini, make_date(v_ano, 12, 1), interval '1 month')::date AS mes LOOP
    v_mes := r.mes;
    v_fim := (v_mes + interval '1 month - 1 day')::date;
    v_val := '{}'::jsonb;
    v_fonte := '{}'::jsonb;
    v_soc := '{}'::jsonb;

    IF v_mes <= v_comp THEN
      v_rec := _wb_caixa(v_emp, 'receber', v_mes, v_fim);
      v_desp := _wb_caixa(v_emp, 'pagar', v_mes, v_fim);
      v_val := v_val || jsonb_build_object('receita_caixa', v_rec, 'despesa_caixa', v_desp);
      v_val := v_val || jsonb_build_object('faturamento',
        (SELECT coalesce(sum(nf.valor_total), 0) FROM notas_fiscais nf
          WHERE nf.empresa_id = v_emp AND nf.tipo = 'saida'
            AND nf.status IN ('confirmada', 'importada')
            AND nf.data_emissao BETWEEN v_mes AND v_fim));
      v_est := _wb_estoque(v_emp, v_fim);
      v_val := v_val || jsonb_build_object('estoque_materiais', v_est->'materiais', 'estoque_produtos', v_est->'produtos');
      v_aging := _wb_aging(v_emp, 'receber', v_fim);
      FOREACH k IN ARRAY v_faixas LOOP
        v_val := v_val || jsonb_build_object('aging_cr_' || k, v_aging->k);
      END LOOP;
      v_aging := _wb_aging(v_emp, 'pagar', v_fim);
      FOREACH k IN ARRAY v_faixas LOOP
        v_val := v_val || jsonb_build_object('aging_cp_' || k, v_aging->k);
      END LOOP;
      SELECT jsonb_object_agg(key, 'erp'::text) INTO v_fonte FROM jsonb_object_keys(v_val) key;

      IF extract(month FROM v_mes) = 1 THEN
        v_lucro_ytd := 0;
      END IF;
      v_lucro_ytd := v_lucro_ytd + _wb_caixa(v_emp, 'receber', v_mes, v_fim, true) - v_desp;

      FOR s IN SELECT id, percentual_participacao_atual AS pct FROM socios WHERE empresa_id = v_emp AND ativo LOOP
        v_soc := v_soc || jsonb_build_object(s.id::text, jsonb_build_object(
          'saldo', round(v_lucro_ytd * s.pct / 100, 2),
          'prolabore', (SELECT coalesce(sum(coalesce(sr.valor_aprovado, sr.valor_calculado)), 0)
                          FROM socios_retiradas sr
                         WHERE sr.socio_id = s.id AND sr.tipo = 'pro_labore'
                           AND sr.status IN ('aprovado', 'financeiro_gerado', 'pago')
                           AND sr.competencia = to_char(v_mes, 'YYYY-MM')),
          'fonte', 'erp'));
      END LOOP;
    END IF;

    FOR s IN SELECT metrica, chave, valor, fonte FROM workbook_valores_mensais
              WHERE empresa_id = v_emp AND competencia = to_char(v_mes, 'YYYY-MM') AND v_mes <= v_comp LOOP
      IF s.chave = '' THEN
        v_val := v_val || jsonb_build_object(s.metrica, s.valor);
        v_fonte := v_fonte || jsonb_build_object(s.metrica, s.fonte);
      ELSIF s.metrica IN ('socio_saldo', 'socio_prolabore') THEN
        v_soc := v_soc || jsonb_build_object(s.chave,
          coalesce(v_soc->s.chave, '{}'::jsonb)
            || jsonb_build_object(CASE s.metrica WHEN 'socio_saldo' THEN 'saldo' ELSE 'prolabore' END, s.valor, 'fonte', s.fonte));
      END IF;
    END LOOP;

    -- Caixa acumulado e ajuste pelo caixa final informado.
    IF v_mes <= v_comp THEN
      IF v_mes > v_ini THEN
        v_caixa := v_caixa + coalesce((v_val->>'receita_caixa')::numeric, 0) - coalesce((v_val->>'despesa_caixa')::numeric, 0);
      END IF;
      v_val := v_val || jsonb_build_object('caixa_final_calculado', round(v_caixa, 2));
      IF v_val ? 'caixa_final' THEN
        v_ajuste := (v_val->>'caixa_final')::numeric - v_caixa;
        IF v_mes = v_ini THEN
          -- dez/(ano-3) fica fora do caixa do modelo: o ajuste entra no saldo anterior.
          v_saldo_ant := v_saldo_ant + v_ajuste;
        ELSE
          v_val := v_val || jsonb_build_object('ajuste_caixa', round(v_ajuste, 2));
          v_fonte := v_fonte || jsonb_build_object('ajuste_caixa', v_fonte->>'caixa_final');
        END IF;
        v_caixa := (v_val->>'caixa_final')::numeric;
      ELSE
        v_val := v_val || jsonb_build_object('caixa_final', round(v_caixa, 2));
      END IF;
    END IF;

    v_meses := v_meses || jsonb_build_array(jsonb_build_object(
      'competencia', to_char(v_mes, 'YYYY-MM'),
      'fechado', v_mes <= v_comp,
      'valores', v_val,
      'fontes', coalesce(v_fonte, '{}'::jsonb),
      'socios', v_soc));
  END LOOP;

  RETURN jsonb_build_object(
    'competencia', p_competencia,
    'ano', v_ano,
    'saldo_caixa_anterior', v_saldo_ant,
    'meses', v_meses,
    'socios', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', s2.id, 'nome', s2.nome,
                  'nome_exibicao', coalesce(nullif(trim(s2.nome_exibicao), ''),
                                            initcap(split_part(s2.nome, ' ', 1)) || ' ' ||
                                            initcap(regexp_replace(s2.nome, '^.* ', ''))),
                  'percentual', s2.percentual_participacao_atual)
                ORDER BY coalesce(nullif(trim(s2.nome_exibicao), ''), s2.nome)), '[]'::jsonb)
                 FROM socios s2 WHERE s2.empresa_id = v_emp AND s2.ativo),
    'parametros', (SELECT coalesce(jsonb_object_agg(p.ano::text, jsonb_build_object(
                     'crescimento_meta', p.crescimento_meta, 'limite_faturamento', p.limite_faturamento)), '{}'::jsonb)
                     FROM workbook_parametros_anuais p
                    WHERE p.empresa_id = v_emp AND p.ano BETWEEN v_ano - 2 AND v_ano)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workbook_fechamento_dados(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workbook_fechamento_dados(text) TO authenticated;
