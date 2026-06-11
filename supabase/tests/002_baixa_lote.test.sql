-- 002_baixa_lote.test.sql
-- Cobre public.financeiro_processar_baixa_lote → registrar_baixa_lote_financeira.
-- Contratos: baixa total, parcial, lote misto, idempotência, excesso.

BEGIN;
SELECT plan(7);

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

INSERT INTO public.contas_bancarias (id, descricao, ativo, empresa_id)
VALUES ('00000000-0000-0000-0000-0000000000cb', 'Conta Teste', true,
        '00000000-0000-0000-0000-0000000000ee');

INSERT INTO public.financeiro_lancamentos
  (id, tipo, descricao, valor, data_vencimento, status, empresa_id)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   'receber', 'Título 1', 100.00, CURRENT_DATE, 'aberto',
   '00000000-0000-0000-0000-0000000000ee'),
  ('aaaaaaaa-0000-0000-0000-000000000002',
   'receber', 'Título 2', 200.00, CURRENT_DATE, 'aberto',
   '00000000-0000-0000-0000-0000000000ee'),
  ('aaaaaaaa-0000-0000-0000-000000000003',
   'receber', 'Título pago', 300.00, CURRENT_DATE, 'pago',
   '00000000-0000-0000-0000-0000000000ee');

-- 1) Baixa total: processados=1
SELECT is(
  (public.financeiro_processar_baixa_lote(jsonb_build_array(
    jsonb_build_object(
      'lancamento_id', 'aaaaaaaa-0000-0000-0000-000000000001',
      'valor_pago',    100.00,
      'data_baixa',    CURRENT_DATE::text,
      'forma_pagamento', 'pix',
      'conta_bancaria_id', '00000000-0000-0000-0000-0000000000cb'
    )
  )))->>'processados',
  '1',
  'baixa total: processados = 1'
);

-- 2) Status do Título 1 vira pago
SELECT is(
  (SELECT status FROM public.financeiro_lancamentos
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'pago',
  'baixa total: status vira pago'
);

-- 3) Registro em financeiro_baixas
SELECT is(
  (SELECT count(*)::int FROM public.financeiro_baixas
   WHERE lancamento_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'baixa total: 1 registro em financeiro_baixas'
);

-- 4) Baixa parcial: saldo_restante = 150
SELECT public.financeiro_processar_baixa_lote(jsonb_build_array(
  jsonb_build_object(
    'lancamento_id', 'aaaaaaaa-0000-0000-0000-000000000002',
    'valor_pago', 50.00,
    'data_baixa', CURRENT_DATE::text,
    'forma_pagamento', 'pix',
    'conta_bancaria_id', '00000000-0000-0000-0000-0000000000cb'
  )
));
SELECT is(
  (SELECT saldo_restante FROM public.financeiro_lancamentos
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  150.00::numeric,
  'baixa parcial: saldo_restante = 150'
);

-- 5) Lote misto: pago é ignorado
SELECT is(
  (public.financeiro_processar_baixa_lote(jsonb_build_array(
    jsonb_build_object(
      'lancamento_id', 'aaaaaaaa-0000-0000-0000-000000000003',
      'valor_pago', 300.00, 'data_baixa', CURRENT_DATE::text,
      'forma_pagamento', 'pix',
      'conta_bancaria_id', '00000000-0000-0000-0000-0000000000cb'
    )
  )))->>'ignorados',
  '1',
  'lote misto: título pago é ignorado'
);

-- 6) Idempotência
SELECT public.financeiro_processar_baixa_lote(jsonb_build_array(
  jsonb_build_object(
    'lancamento_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'valor_pago', 100.00, 'data_baixa', CURRENT_DATE::text,
    'forma_pagamento', 'pix',
    'conta_bancaria_id', '00000000-0000-0000-0000-0000000000cb'
  )
));
SELECT is(
  (SELECT count(*)::int FROM public.financeiro_baixas
   WHERE lancamento_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'idempotência: reprocesso não duplica baixas'
);

-- 7) Valor excedente vira erro no retorno
SELECT ok(
  jsonb_array_length(
    (public.financeiro_processar_baixa_lote(jsonb_build_array(
      jsonb_build_object(
        'lancamento_id', 'aaaaaaaa-0000-0000-0000-000000000002',
        'valor_pago', 9999.00, 'data_baixa', CURRENT_DATE::text,
        'forma_pagamento', 'pix',
        'conta_bancaria_id', '00000000-0000-0000-0000-0000000000cb'
      )
    )))->'erros'
  ) >= 1,
  'valor excedente vira item em erros (loop captura a exceção)'
);

SELECT * FROM finish();
ROLLBACK;