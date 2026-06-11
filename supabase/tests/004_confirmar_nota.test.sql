-- 004_confirmar_nota.test.sql
-- Esqueleto: cobrir `confirmar_nota_fiscal` / `confirmar_nfse` / `confirmar_cte`.
--
-- AJUSTAR antes de rodar: fixtures de nota em rascunho + duplicatas.

BEGIN;
SELECT plan(1);
SELECT pass('Esqueleto criado — implementar asserts de geração financeira e idempotência');
SELECT * FROM finish();
ROLLBACK;