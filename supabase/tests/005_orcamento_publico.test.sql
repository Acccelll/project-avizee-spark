-- 005_orcamento_publico.test.sql
-- Cobre a RPC `public.get_orcamento_publico(token)` que substituiu o acesso
-- direto às views públicas de orçamento.

BEGIN;
SELECT plan(3);

-- Fixture: cliente + orçamento ativo com token conhecido
INSERT INTO public.clientes (id, nome_razao_social, ativo)
VALUES ('22222222-2222-2222-2222-222222222222', 'Cliente Teste', true);

INSERT INTO public.orcamentos (
  id, numero, cliente_id, data_orcamento, valor_total,
  status, ativo, public_token
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'ORC-TEST-001',
  '22222222-2222-2222-2222-222222222222',
  current_date,
  500.00,
  'pendente',
  true,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- 1) Token correto → payload não nulo
SELECT isnt(
  public.get_orcamento_publico('cccccccc-cccc-cccc-cccc-cccccccccccc'),
  NULL,
  'token válido devolve payload'
);

-- 2) Token inválido → NULL
SELECT is(
  public.get_orcamento_publico('00000000-0000-0000-0000-000000000000'),
  NULL,
  'token inválido devolve NULL'
);

-- 3) Orçamento inativo → NULL
UPDATE public.orcamentos SET ativo = false WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT is(
  public.get_orcamento_publico('cccccccc-cccc-cccc-cccc-cccccccccccc'),
  NULL,
  'orçamento inativo não é devolvido'
);

SELECT * FROM finish();
ROLLBACK;