-- 002_baixa_lote.test.sql
-- Esqueleto: cobrir `registrar_baixa_lote_financeira(p_items jsonb)`.
--
-- AJUSTAR antes de rodar:
-- - Inserir fixtures de contas_bancarias, lancamentos, formas_pagamento.
-- - Verificar o nome canônico da RPC em supabase/migrations.

BEGIN;
SELECT plan(1);
SELECT pass('Esqueleto criado — implementar fixtures e asserts de baixa total/parcial/idempotência');
SELECT * FROM finish();
ROLLBACK;