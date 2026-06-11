-- 003_estoque_ajuste.test.sql
-- Cobre `public.ajustar_estoque_manual` e o guard de saldo negativo.
--
-- Pré-requisitos: usuário admin/estoquista (auth.uid()) — em pgTAP local
-- pode-se mockar com SET LOCAL ou criar um usuário de teste em auth.users.

BEGIN;
SELECT plan(4);

-- ===== FIXTURE: auth + tenancy =====
INSERT INTO auth.users (id, email, aud, role)
VALUES ('00000000-0000-0000-0000-0000000000aa',
        'pgtap@test.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.empresas (id, nome, cnpj, ativo)
VALUES ('00000000-0000-0000-0000-0000000000ee',
        'Empresa Teste', '00000000000191', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_empresas (user_id, empresa_id)
VALUES ('00000000-0000-0000-0000-0000000000aa',
        '00000000-0000-0000-0000-0000000000ee')
ON CONFLICT (user_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id;

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-0000000000aa', 'admin')
ON CONFLICT DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',  '00000000-0000-0000-0000-0000000000aa',
    'role', 'authenticated'
  )::text,
  true
);
-- ===== FIM FIXTURE =====

-- Fixture: produto com saldo 10
INSERT INTO public.produtos (id, nome, sku, ativo, estoque_atual, empresa_id)
VALUES ('11111111-1111-1111-1111-111111111111', 'Produto Teste', 'TST-001', true, 10,
        '00000000-0000-0000-0000-0000000000ee');

-- 1) Entrada soma
SELECT public.ajustar_estoque_manual(
  '11111111-1111-1111-1111-111111111111', 'entrada', 5, 'compra'
);
SELECT is(
  (SELECT estoque_atual FROM public.produtos WHERE id = '11111111-1111-1111-1111-111111111111'),
  15::numeric,
  'entrada de 5 sobre saldo 10 resulta em 15'
);

-- 2) Saída subtrai
SELECT public.ajustar_estoque_manual(
  '11111111-1111-1111-1111-111111111111', 'saida', 3, 'venda'
);
SELECT is(
  (SELECT estoque_atual FROM public.produtos WHERE id = '11111111-1111-1111-1111-111111111111'),
  12::numeric,
  'saída de 3 sobre saldo 15 resulta em 12'
);

-- 3) Guard: saída maior que saldo é rejeitada
SELECT throws_ok(
  $$SELECT public.ajustar_estoque_manual(
      '11111111-1111-1111-1111-111111111111', 'saida', 999, 'venda'
    )$$,
  '23514',
  NULL,
  'saída maior que saldo dispara check_violation (guard de negativo)'
);

-- 4) Saldo intacto após exceção
SELECT is(
  (SELECT estoque_atual FROM public.produtos WHERE id = '11111111-1111-1111-1111-111111111111'),
  12::numeric,
  'saldo permanece 12 após tentativa rejeitada'
);

SELECT * FROM finish();
ROLLBACK;