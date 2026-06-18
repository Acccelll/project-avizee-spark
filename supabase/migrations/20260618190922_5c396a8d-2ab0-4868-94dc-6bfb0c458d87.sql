-- PR-2.4: constraints de integridade em valores monetários de headers transacionais.
-- Todas as constraints são adicionadas como VALID (verificado que zero linhas violam hoje).
-- Mantemos `valor IS NULL` permitido onde a coluna já é nullable em produção.

ALTER TABLE public.orcamentos
  ADD CONSTRAINT chk_orcamentos_valor_total_nonneg
  CHECK (valor_total IS NULL OR valor_total >= 0);

ALTER TABLE public.ordens_venda
  ADD CONSTRAINT chk_ordens_venda_valor_total_nonneg
  CHECK (valor_total IS NULL OR valor_total >= 0);

ALTER TABLE public.pedidos_compra
  ADD CONSTRAINT chk_pedidos_compra_valor_total_nonneg
  CHECK (valor_total IS NULL OR valor_total >= 0);

ALTER TABLE public.compras
  ADD CONSTRAINT chk_compras_valor_total_nonneg
  CHECK (valor_total IS NULL OR valor_total >= 0);

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_notas_fiscais_valor_total_nonneg
  CHECK (valor_total IS NULL OR valor_total >= 0);

ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_financeiro_lancamentos_valor_nonneg
  CHECK (valor IS NULL OR valor >= 0);

ALTER TABLE public.financeiro_baixas
  ADD CONSTRAINT chk_financeiro_baixas_valor_pago_nonneg
  CHECK (valor_pago IS NULL OR valor_pago >= 0);