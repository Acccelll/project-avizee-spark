-- Título a receber de NF de saída nasce com a conta de receita pelo prazo.
--
-- O plano de contas separa a receita de vendas por condição comercial
-- (à vista, 10, 15, 28, 30, 45, 56, 60 e 90 ddl). O título usa a conta do
-- prazo cadastrado mais próximo de (vencimento − emissão da NF); no empate,
-- o maior prazo. No mesmo dia, se o XML traz nº de pedido de marketplace
-- (13+ dígitos), a conta é Venda E-Commerce.
--
-- É a mesma regra aplicada nos 91 títulos existentes em 16/11/2026
-- (docs/revisao-ux/correcao-dados-2026-11-16.md). Conta informada à mão
-- não é sobrescrita, e a regra não faz nada se a conta não existir ou estiver
-- inativa.

SET lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.conta_receita_nf_saida(p_nf_id uuid, p_vencimento date)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emissao date;
  v_refs    text;
  v_dias    integer;
  v_codigo  text;
BEGIN
  SELECT n.data_emissao, coalesce(n.referencias_pedido::text, '')
    INTO v_emissao, v_refs
    FROM public.notas_fiscais n
   WHERE n.id = p_nf_id AND n.tipo = 'saida';

  IF v_emissao IS NULL OR p_vencimento IS NULL THEN
    RETURN NULL;
  END IF;

  v_dias := p_vencimento - v_emissao;

  IF v_dias = 0 AND v_refs ~ '[0-9]{13,}' THEN
    v_codigo := '4.1.1.03.001';                       -- Venda E-Commerce
  ELSE
    SELECT p.codigo INTO v_codigo
      FROM (VALUES (0,  '4.1.1.01.001'),             -- à vista
                   (10, '4.1.1.01.007'),
                   (15, '4.1.1.01.005'),
                   (28, '4.1.1.01.006'),
                   (30, '4.1.1.01.002'),
                   (45, '4.1.1.01.008'),
                   (56, '4.1.1.01.009'),
                   (60, '4.1.1.01.003'),
                   (90, '4.1.1.01.004')) AS p(dias, codigo)
     ORDER BY abs(p.dias - v_dias), p.dias DESC
     LIMIT 1;
  END IF;

  RETURN (SELECT c.id FROM public.contas_contabeis c
           WHERE c.codigo = v_codigo AND c.ativo AND c.aceita_lancamento
           LIMIT 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.conta_receita_nf_saida(uuid, date) FROM PUBLIC, anon;

-- Mesmo gatilho que já leva a conta da NF de entrada ao título a pagar
-- (20261013100100_nf_entrada_conta_gatilhos.sql), agora também para o receber.
CREATE OR REPLACE FUNCTION public.trg_fin_lanc_conta_da_nf()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.nota_fiscal_id IS NOT NULL AND NEW.conta_contabil_id IS NULL THEN
    IF NEW.tipo = 'pagar' THEN
      NEW.conta_contabil_id := public.conta_nf_entrada(NEW.nota_fiscal_id);
    ELSIF NEW.tipo = 'receber' THEN
      NEW.conta_contabil_id := public.conta_receita_nf_saida(NEW.nota_fiscal_id, NEW.data_vencimento);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
