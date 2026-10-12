-- Despesas por categoria:
-- - conta "Retirada Sócio" (3.1.1.04.*) entra como Pró-labore, igual às
--   retiradas lançadas pelo módulo de sócios;
-- - matéria-prima (1.1.5.02.001/002) fica separada de mercadorias para revenda.

CREATE OR REPLACE FUNCTION public._apr_categoria_despesa(p_origem_tabela text, p_origem_tipo text, p_cartao_fatura uuid, p_cc_codigo text, p_cc_descricao text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_origem_tabela = 'socios_retiradas' THEN 'Pró-labore'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.04.%' THEN 'Pró-labore'
    WHEN p_cartao_fatura IS NOT NULL OR p_origem_tipo = 'cartao_fatura' THEN 'Cartão: a classificar'
    WHEN p_cc_codigo IN ('1.1.5.02.001', '1.1.5.02.002') THEN 'Matéria-prima'
    WHEN coalesce(p_cc_codigo, '') LIKE '1.1.5.%' THEN 'Mercadorias para revenda'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.11.%' THEN 'Impostos e taxas'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.02.%' THEN 'Pessoal'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.2.%' THEN 'Despesas financeiras'
    WHEN nullif(trim(p_cc_descricao), '') IS NOT NULL THEN trim(p_cc_descricao)
    WHEN p_origem_tipo = 'fiscal_nota' THEN 'Mercadorias para revenda'
    ELSE 'Outras despesas'
  END;
$$;
