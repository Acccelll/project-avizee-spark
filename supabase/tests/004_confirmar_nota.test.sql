-- 004_confirmar_nota.test.sql
-- Cobre public.confirmar_nota_fiscal: NF inexistente, reconfirmação bloqueada,
-- efeitos de estoque e financeiro.

BEGIN;
SELECT plan(6);

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

INSERT INTO public.fornecedores (id, nome_razao_social, ativo, empresa_id)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'Fornecedor Teste', true,
        '00000000-0000-0000-0000-0000000000ee');

INSERT INTO public.produtos (id, nome, sku, ativo, estoque_atual, empresa_id)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'Produto NF', 'NF-001', true, 0,
        '00000000-0000-0000-0000-0000000000ee');

INSERT INTO public.notas_fiscais
  (id, tipo, status, fornecedor_id, valor_total, data_emissao, empresa_id,
   gera_financeiro, movimenta_estoque)
VALUES
  ('cccccccc-0000-0000-0000-000000000001',
   'entrada', 'pendente',
   'bbbbbbbb-0000-0000-0000-000000000001',
   500.00, CURRENT_DATE,
   '00000000-0000-0000-0000-0000000000ee',
   true, true);

INSERT INTO public.notas_fiscais_itens
  (nota_fiscal_id, produto_id, descricao_snapshot, quantidade, valor_unitario,
   valor_total, empresa_id)
VALUES
  ('cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000002',
   'Produto NF', 2, 250.00, 500.00,
   '00000000-0000-0000-0000-0000000000ee');

-- 1) NF inexistente
SELECT throws_like(
  $$SELECT public.confirmar_nota_fiscal(
      '00000000-0000-0000-0000-000000000000'::uuid)$$,
  '%não encontrada%',
  'NF inexistente lança exceção'
);

-- 2) Confirmar NF válida
SELECT lives_ok(
  $$SELECT public.confirmar_nota_fiscal(
      'cccccccc-0000-0000-0000-000000000001'::uuid)$$,
  'confirmar NF pendente executa sem erro'
);

-- 3) Status virou confirmada
SELECT is(
  (SELECT status FROM public.notas_fiscais
   WHERE id = 'cccccccc-0000-0000-0000-000000000001'),
  'confirmada',
  'confirmação: status = confirmada'
);

-- 4) Estoque aumentou
SELECT is(
  (SELECT estoque_atual FROM public.produtos
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  2.0::numeric,
  'confirmação entrada: estoque aumentou pela quantidade do item'
);

-- 5) Lançamento financeiro criado
SELECT is(
  (SELECT count(*)::int FROM public.financeiro_lancamentos
   WHERE nota_fiscal_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'confirmação: 1 lançamento financeiro criado'
);

-- 6) Reconfirmar é rejeitado
SELECT throws_like(
  $$SELECT public.confirmar_nota_fiscal(
      'cccccccc-0000-0000-0000-000000000001'::uuid)$$,
  '%já está em status%',
  'reconfirmar NF já confirmada é rejeitado'
);

SELECT * FROM finish();
ROLLBACK;