-- =============================================================
-- SEED: Dados de Exemplo para o ERP Avizee
-- =============================================================
-- Este script popula o banco com dados realistas para demonstração.
-- Utiliza UUIDs fixos para permitir referências cruzadas entre tabelas.
-- =============================================================

DO $$
DECLARE
  -- Grupos de produto
  gp_eletronicos    UUID := 'a1000000-0000-0000-0000-000000000001';
  gp_informatica    UUID := 'a1000000-0000-0000-0000-000000000002';
  gp_acessorios     UUID := 'a1000000-0000-0000-0000-000000000003';
  gp_periferico     UUID := 'a1000000-0000-0000-0000-000000000004';

  -- Bancos
  banco_bb          UUID := 'b1000000-0000-0000-0000-000000000001';
  banco_itau        UUID := 'b1000000-0000-0000-0000-000000000002';
  banco_bradesco    UUID := 'b1000000-0000-0000-0000-000000000003';

  -- Contas bancárias
  conta_principal   UUID := 'c1000000-0000-0000-0000-000000000001';
  conta_reserva     UUID := 'c1000000-0000-0000-0000-000000000002';

  -- Formas de pagamento
  fp_avista         UUID := 'f1000000-0000-0000-0000-000000000001';
  fp_30d            UUID := 'f1000000-0000-0000-0000-000000000002';
  fp_3060d          UUID := 'f1000000-0000-0000-0000-000000000003';
  fp_cartao         UUID := 'f1000000-0000-0000-0000-000000000004';

  -- Clientes
  cli_tecnomax      UUID := 'd1000000-0000-0000-0000-000000000001';
  cli_digital       UUID := 'd1000000-0000-0000-0000-000000000002';
  cli_solucoes      UUID := 'd1000000-0000-0000-0000-000000000003';
  cli_startup       UUID := 'd1000000-0000-0000-0000-000000000004';
  cli_joao          UUID := 'd1000000-0000-0000-0000-000000000005';
  cli_maria         UUID := 'd1000000-0000-0000-0000-000000000006';

  -- Fornecedores
  for_distribuidora UUID := 'e1000000-0000-0000-0000-000000000001';
  for_importadora   UUID := 'e1000000-0000-0000-0000-000000000002';
  for_fabricante    UUID := 'e1000000-0000-0000-0000-000000000003';
  for_atacadista    UUID := 'e1000000-0000-0000-0000-000000000004';

  -- Transportadoras
  transp_fedex      UUID := 't1000000-0000-0000-0000-000000000001';
  transp_jadlog     UUID := 't1000000-0000-0000-0000-000000000002';

  -- Funcionários
  func_ana          UUID := 'h1000000-0000-0000-0000-000000000001';
  func_carlos       UUID := 'h1000000-0000-0000-0000-000000000002';
  func_paula        UUID := 'h1000000-0000-0000-0000-000000000003';

  -- Produtos
  prod_notebook     UUID := 'p1000000-0000-0000-0000-000000000001';
  prod_monitor      UUID := 'p1000000-0000-0000-0000-000000000002';
  prod_teclado      UUID := 'p1000000-0000-0000-0000-000000000003';
  prod_mouse        UUID := 'p1000000-0000-0000-0000-000000000004';
  prod_headset      UUID := 'p1000000-0000-0000-0000-000000000005';
  prod_cabo_hdmi    UUID := 'p1000000-0000-0000-0000-000000000006';
  prod_ssd          UUID := 'p1000000-0000-0000-0000-000000000007';
  prod_memoria_ram  UUID := 'p1000000-0000-0000-0000-000000000008';
  prod_webcam       UUID := 'p1000000-0000-0000-0000-000000000009';
  prod_mousepad     UUID := 'p1000000-0000-0000-0000-000000000010';

  -- Orçamentos
  orc_001           UUID := 'q1000000-0000-0000-0000-000000000001';
  orc_002           UUID := 'q1000000-0000-0000-0000-000000000002';
  orc_003           UUID := 'q1000000-0000-0000-0000-000000000003';

  -- Ordens de venda
  ov_001            UUID := 'o1000000-0000-0000-0000-000000000001';
  ov_002            UUID := 'o1000000-0000-0000-0000-000000000002';
  ov_003            UUID := 'o1000000-0000-0000-0000-000000000003';

  -- Notas fiscais de saída
  nf_001            UUID := 'n1000000-0000-0000-0000-000000000001';
  nf_002            UUID := 'n1000000-0000-0000-0000-000000000002';
  nf_003            UUID := 'n1000000-0000-0000-0000-000000000003';

  -- Compras
  cmp_001           UUID := 'x1000000-0000-0000-0000-000000000001';
  cmp_002           UUID := 'x1000000-0000-0000-0000-000000000002';

BEGIN

-- =============================================================
-- 1. EMPRESA CONFIG
-- =============================================================
INSERT INTO public.empresa_config (
  id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
  telefone, email, logradouro, numero, complemento, bairro,
  cidade, uf, cep, responsavel, site, whatsapp
) VALUES (
  gen_random_uuid(),
  'Avizee Distribuidora de Tecnologia Ltda',
  'Avizee Tech',
  '12.345.678/0001-90',
  '123.456.789.000',
  '(11) 3210-5000',
  'contato@avizee.com.br',
  'Av. Paulista',
  '1500',
  'Conj. 801',
  'Bela Vista',
  'São Paulo',
  'SP',
  '01310-100',
  'Roberto Alves',
  'www.avizee.com.br',
  '(11) 99876-5432'
)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 2. GRUPOS DE PRODUTO
-- =============================================================
INSERT INTO public.grupos_produto (id, nome, descricao) VALUES
  (gp_eletronicos, 'Eletrônicos',  'Equipamentos eletrônicos em geral'),
  (gp_informatica, 'Informática',  'Computadores, notebooks e servidores'),
  (gp_acessorios,  'Acessórios',   'Acessórios e cabos'),
  (gp_periferico,  'Periféricos',  'Periféricos de computador')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 3. BANCOS
-- =============================================================
INSERT INTO public.bancos (id, nome, tipo) VALUES
  (banco_bb,       'Banco do Brasil',    'banco'),
  (banco_itau,     'Itaú Unibanco',      'banco'),
  (banco_bradesco, 'Bradesco',           'banco')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 4. CONTAS BANCÁRIAS
-- =============================================================
INSERT INTO public.contas_bancarias (id, banco_id, descricao, agencia, conta, titular, saldo_atual) VALUES
  (conta_principal, banco_itau,     'Conta Corrente Principal', '0341',  '12345-6',  'Avizee Distribuidora de Tecnologia Ltda', 85420.50),
  (conta_reserva,   banco_bradesco, 'Conta Reserva',            '3098',  '98765-4',  'Avizee Distribuidora de Tecnologia Ltda', 22100.00)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 5. FORMAS DE PAGAMENTO
-- =============================================================
INSERT INTO public.formas_pagamento (id, descricao, prazo_dias, parcelas, tipo, gera_financeiro) VALUES
  (fp_avista,  'À Vista',         0,  1, 'dinheiro', true),
  (fp_30d,     '30 dias',        30,  1, 'boleto',   true),
  (fp_3060d,   '30/60 dias',     60,  2, 'boleto',   true),
  (fp_cartao,  'Cartão Crédito',  0,  1, 'cartao',   true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 6. CLIENTES
-- =============================================================
INSERT INTO public.clientes (
  id, tipo_pessoa, nome_razao_social, nome_fantasia, cpf_cnpj,
  inscricao_estadual, email, telefone, celular, contato,
  prazo_padrao, limite_credito,
  logradouro, numero, bairro, cidade, uf, cep,
  ativo, codigo_legado
) VALUES
  (
    cli_tecnomax, 'J', 'Tecnomax Soluções em TI Ltda', 'Tecnomax',
    '34.567.890/0001-12', '234.567.890.001',
    'compras@tecnomax.com.br', '(11) 2345-6789', '(11) 91234-5678',
    'Fernanda Lima', 30, 50000.00,
    'Rua Augusta', '2100', 'Consolação', 'São Paulo', 'SP', '01305-100',
    true, 'CLI001'
  ),
  (
    cli_digital, 'J', 'Digital Office Comércio de Informática Eireli', 'Digital Office',
    '56.789.012/0001-34', '345.678.901.002',
    'pedidos@digitaloffice.com.br', '(21) 3456-7890', '(21) 98765-4321',
    'Marcos Souza', 30, 30000.00,
    'Av. Rio Branco', '156', 'Centro', 'Rio de Janeiro', 'RJ', '20040-901',
    true, 'CLI002'
  ),
  (
    cli_solucoes, 'J', 'Soluções Corporativas de Tecnologia S.A.', 'CorpTech',
    '78.901.234/0001-56', '456.789.012.003',
    'ti@corptech.com.br', '(41) 3567-8901', '(41) 99876-5432',
    'Beatriz Costa', 45, 80000.00,
    'Rua XV de Novembro', '500', 'Centro', 'Curitiba', 'PR', '80020-310',
    true, 'CLI003'
  ),
  (
    cli_startup, 'J', 'Startup Inovação Digital Ltda', 'InovaDigital',
    '90.123.456/0001-78', NULL,
    'hello@inovadigital.io', '(48) 3678-9012', '(48) 98765-1234',
    'Lucas Martins', 15, 15000.00,
    'Rua Felipe Schmidt', '515', 'Centro', 'Florianópolis', 'SC', '88010-001',
    true, 'CLI004'
  ),
  (
    cli_joao, 'F', 'João Carlos Pereira', NULL,
    '123.456.789-00', NULL,
    'joaocarlos@email.com', NULL, '(11) 97654-3210',
    NULL, 0, 5000.00,
    'Rua das Flores', '123', 'Jardim Primavera', 'São Paulo', 'SP', '04567-890',
    true, 'CLI005'
  ),
  (
    cli_maria, 'F', 'Maria Fernanda Oliveira', NULL,
    '987.654.321-00', NULL,
    'mariafernanda@email.com', NULL, '(21) 96543-2109',
    NULL, 0, 3000.00,
    'Rua do Catete', '45', 'Catete', 'Rio de Janeiro', 'RJ', '22220-001',
    true, 'CLI006'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 7. FORNECEDORES
-- =============================================================
INSERT INTO public.fornecedores (
  id, tipo_pessoa, nome_razao_social, nome_fantasia, cpf_cnpj,
  inscricao_estadual, email, telefone, contato,
  prazo_padrao,
  logradouro, numero, bairro, cidade, uf, cep,
  ativo, codigo_legado
) VALUES
  (
    for_distribuidora, 'J',
    'Alpha Distribuidora de Componentes Ltda', 'Alpha Dist.',
    '11.222.333/0001-44', '111.222.333.000',
    'vendas@alphadist.com.br', '(11) 4000-5000', 'Rodrigo Santos',
    28,
    'Rua da Mooca', '2500', 'Mooca', 'São Paulo', 'SP', '03103-001',
    true, 'FOR001'
  ),
  (
    for_importadora, 'J',
    'BrasilImport Tecnologia e Importação Ltda', 'BrasilImport',
    '22.333.444/0001-55', '222.333.444.001',
    'comercial@brasilimport.com.br', '(11) 5000-6000', 'Priscila Nunes',
    30,
    'Av. Brigadeiro Faria Lima', '3477', 'Itaim Bibi', 'São Paulo', 'SP', '04538-133',
    true, 'FOR002'
  ),
  (
    for_fabricante, 'J',
    'TechParts Fabricação de Componentes S.A.', 'TechParts',
    '33.444.555/0001-66', '333.444.555.002',
    'pedidos@techparts.com.br', '(19) 3100-4000', 'Gustavo Ramos',
    45,
    'Rua Industrial', '800', 'Distrito Industrial', 'Campinas', 'SP', '13041-020',
    true, 'FOR003'
  ),
  (
    for_atacadista, 'J',
    'Mega Atacado de Eletrônicos Ltda', 'MegaAtacado',
    '44.555.666/0001-77', '444.555.666.003',
    'atacado@megaatacado.com.br', '(11) 6000-7000', 'Carla Mendes',
    21,
    'Av. do Estado', '5000', 'Ipiranga', 'São Paulo', 'SP', '04282-000',
    true, 'FOR004'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 8. TRANSPORTADORAS
-- =============================================================
INSERT INTO public.transportadoras (
  id, nome_razao_social, nome_fantasia, cpf_cnpj, email, telefone,
  logradouro, numero, bairro, cidade, uf, cep, modalidade, ativo
) VALUES
  (
    transp_fedex, 'FedEx Brasil Ltda', 'FedEx',
    '55.666.777/0001-88',
    'atendimento@fedex.com.br', '0800 725 3339',
    'Av. Morumbi', '8234', 'Jurubatuba', 'São Paulo', 'SP', '04703-002', 'aereo', true
  ),
  (
    transp_jadlog, 'Jadlog Logística S.A.', 'Jadlog',
    '66.777.888/0001-99',
    'sac@jadlog.com.br', '(11) 3003-3231',
    'Rodovia Raposo Tavares', '1580', 'Jardim Íris', 'São Paulo', 'SP', '05577-001', 'rodoviario', true
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 9. FUNCIONÁRIOS
-- =============================================================
INSERT INTO public.funcionarios (
  id, nome, cpf, cargo, departamento,
  data_admissao, salario_base, tipo_contrato, ativo
) VALUES
  (
    func_ana, 'Ana Paula Rodrigues', '111.222.333-44',
    'Gerente de Vendas', 'Comercial',
    '2023-03-01', 8500.00, 'clt', true
  ),
  (
    func_carlos, 'Carlos Eduardo Silva', '222.333.444-55',
    'Analista Financeiro', 'Financeiro',
    '2022-08-15', 6200.00, 'clt', true
  ),
  (
    func_paula, 'Paula Cristina Nascimento', '333.444.555-66',
    'Assistente de Estoque', 'Logística',
    '2024-01-10', 3800.00, 'clt', true
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 10. PRODUTOS
-- =============================================================
INSERT INTO public.produtos (
  id, sku, codigo_interno, nome, descricao,
  grupo_id, unidade_medida,
  preco_custo, preco_venda,
  estoque_atual, estoque_minimo, estoque_ideal,
  ncm, peso, ativo, codigo_legado, tipo_item
) VALUES
  (
    prod_notebook, 'NB-PRO15', 'PROD-001',
    'Notebook Pro 15" Core i7', 'Notebook 15.6" Intel Core i7-1255U 16GB RAM 512GB SSD',
    gp_informatica, 'UN',
    3200.00, 4999.90,
    25, 5, 30,
    '8471.30.12', 2.2, true, 'PROD001', 'produto'
  ),
  (
    prod_monitor, 'MON-27FHD', 'PROD-002',
    'Monitor 27" Full HD IPS', 'Monitor LED 27" Full HD 1920x1080 IPS 75Hz',
    gp_periferico, 'UN',
    650.00, 1199.90,
    40, 10, 50,
    '8528.52.20', 4.5, true, 'PROD002', 'produto'
  ),
  (
    prod_teclado, 'TEC-MECK', 'PROD-003',
    'Teclado Mecânico Gamer RGB', 'Teclado mecânico switch Blue ABNT2 com iluminação RGB',
    gp_periferico, 'UN',
    120.00, 279.90,
    80, 20, 100,
    '8471.60.52', 0.9, true, 'PROD003', 'produto'
  ),
  (
    prod_mouse, 'MOU-OPT6K', 'PROD-004',
    'Mouse Óptico 6400 DPI', 'Mouse óptico sem fio 6400 DPI com receptor USB',
    gp_periferico, 'UN',
    55.00, 139.90,
    120, 30, 150,
    '8471.60.53', 0.12, true, 'PROD004', 'produto'
  ),
  (
    prod_headset, 'HS-STEREO7', 'PROD-005',
    'Headset Stereo 7.1 USB', 'Headset surround virtual 7.1 USB com microfone retrátil',
    gp_periferico, 'UN',
    80.00, 199.90,
    60, 15, 75,
    '8518.30.00', 0.35, true, 'PROD005', 'produto'
  ),
  (
    prod_cabo_hdmi, 'CAB-HDMI2M', 'PROD-006',
    'Cabo HDMI 2.0 2 metros', 'Cabo HDMI 2.0 4K 60Hz 2 metros',
    gp_acessorios, 'UN',
    12.00, 39.90,
    200, 50, 250,
    '8544.42.00', 0.08, true, 'PROD006', 'produto'
  ),
  (
    prod_ssd, 'SSD-480G', 'PROD-007',
    'SSD 480GB SATA III', 'SSD 2.5" 480GB SATA III 550MB/s leitura',
    gp_informatica, 'UN',
    180.00, 349.90,
    50, 10, 60,
    '8471.70.90', 0.07, true, 'PROD007', 'produto'
  ),
  (
    prod_memoria_ram, 'RAM-8GB', 'PROD-008',
    'Memória RAM 8GB DDR4 3200MHz', 'Módulo de memória DDR4 8GB 3200MHz CL16',
    gp_informatica, 'UN',
    95.00, 199.90,
    70, 15, 80,
    '8473.30.49', 0.03, true, 'PROD008', 'produto'
  ),
  (
    prod_webcam, 'WEB-FULLHD', 'PROD-009',
    'Webcam Full HD 1080p', 'Webcam USB Full HD 1080p 30fps com microfone integrado',
    gp_eletronicos, 'UN',
    90.00, 219.90,
    35, 8, 40,
    '8525.80.29', 0.18, true, 'PROD009', 'produto'
  ),
  (
    prod_mousepad, 'MAP-GXL', 'PROD-010',
    'Mousepad Gamer XL 800x400', 'Mousepad gamer 800x400mm antiderrapante',
    gp_acessorios, 'UN',
    18.00, 59.90,
    150, 30, 180,
    '3926.90.40', 0.55, true, 'PROD010', 'produto'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 11. MOVIMENTOS DE ESTOQUE INICIAL
-- =============================================================
INSERT INTO public.estoque_movimentos (
  produto_id, tipo, quantidade,
  saldo_anterior, saldo_atual,
  motivo, documento_tipo
) VALUES
  (prod_notebook,    'entrada', 25,  0,   25,  'Estoque inicial', 'manual'),
  (prod_monitor,     'entrada', 40,  0,   40,  'Estoque inicial', 'manual'),
  (prod_teclado,     'entrada', 80,  0,   80,  'Estoque inicial', 'manual'),
  (prod_mouse,       'entrada', 120, 0,   120, 'Estoque inicial', 'manual'),
  (prod_headset,     'entrada', 60,  0,   60,  'Estoque inicial', 'manual'),
  (prod_cabo_hdmi,   'entrada', 200, 0,   200, 'Estoque inicial', 'manual'),
  (prod_ssd,         'entrada', 50,  0,   50,  'Estoque inicial', 'manual'),
  (prod_memoria_ram, 'entrada', 70,  0,   70,  'Estoque inicial', 'manual'),
  (prod_webcam,      'entrada', 35,  0,   35,  'Estoque inicial', 'manual'),
  (prod_mousepad,    'entrada', 150, 0,   150, 'Estoque inicial', 'manual');

-- =============================================================
-- 12. ORÇAMENTOS
-- =============================================================
INSERT INTO public.orcamentos (
  id, numero, cliente_id,
  data_orcamento, validade,
  valor_total, status,
  prazo_pagamento, prazo_entrega, frete_tipo,
  frete_valor, observacoes,
  cliente_snapshot, ativo
) VALUES
  (
    orc_001, 'ORC-2026-001', cli_tecnomax,
    CURRENT_DATE - 10, CURRENT_DATE + 20,
    6598.50, 'aprovado',
    '30 dias', '5 dias úteis', 'cif',
    0.00, 'Pedido urgente para TI.',
    jsonb_build_object(
      'nome', 'Tecnomax Soluções em TI Ltda',
      'cnpj', '34.567.890/0001-12',
      'email', 'compras@tecnomax.com.br',
      'cidade', 'São Paulo',
      'uf', 'SP'
    ),
    true
  ),
  (
    orc_002, 'ORC-2026-002', cli_digital,
    CURRENT_DATE - 5, CURRENT_DATE + 25,
    2359.50, 'enviado',
    'À vista', '3 dias úteis', 'fob',
    35.00, NULL,
    jsonb_build_object(
      'nome', 'Digital Office Comércio de Informática Eireli',
      'cnpj', '56.789.012/0001-34',
      'email', 'pedidos@digitaloffice.com.br',
      'cidade', 'Rio de Janeiro',
      'uf', 'RJ'
    ),
    true
  ),
  (
    orc_003, 'ORC-2026-003', cli_startup,
    CURRENT_DATE - 2, CURRENT_DATE + 28,
    1379.50, 'rascunho',
    '30/60 dias', '7 dias úteis', 'fob',
    50.00, 'Aguardando aprovação do cliente.',
    jsonb_build_object(
      'nome', 'Startup Inovação Digital Ltda',
      'cnpj', '90.123.456/0001-78',
      'email', 'hello@inovadigital.io',
      'cidade', 'Florianópolis',
      'uf', 'SC'
    ),
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Itens dos orçamentos
INSERT INTO public.orcamentos_itens (
  orcamento_id, produto_id,
  codigo_snapshot, descricao_snapshot,
  quantidade, unidade,
  valor_unitario, valor_total,
  peso_unitario, peso_total, custo_unitario
) VALUES
  -- ORC-001
  (orc_001, prod_notebook,    'PROD-001', 'Notebook Pro 15" Core i7',        1, 'UN', 4999.90, 4999.90, 2.20, 2.20, 3200.00),
  (orc_001, prod_monitor,     'PROD-002', 'Monitor 27" Full HD IPS',          1, 'UN', 1199.90, 1199.90, 4.50, 4.50,  650.00),
  (orc_001, prod_cabo_hdmi,   'PROD-006', 'Cabo HDMI 2.0 2 metros',           1, 'UN',   39.90,   39.90, 0.08, 0.08,   12.00),
  (orc_001, prod_mousepad,    'PROD-010', 'Mousepad Gamer XL 800x400',        1, 'UN',   59.90,   59.90, 0.55, 0.55,   18.00),
  (orc_001, prod_mouse,       'PROD-004', 'Mouse Óptico 6400 DPI',            2, 'UN',  139.90,  279.80, 0.12, 0.24,   55.00),
  -- ORC-002
  (orc_002, prod_teclado,     'PROD-003', 'Teclado Mecânico Gamer RGB',       3, 'UN',  279.90,  839.70, 0.90, 2.70,  120.00),
  (orc_002, prod_mouse,       'PROD-004', 'Mouse Óptico 6400 DPI',            3, 'UN',  139.90,  419.70, 0.12, 0.36,   55.00),
  (orc_002, prod_headset,     'PROD-005', 'Headset Stereo 7.1 USB',           3, 'UN',  199.90,  599.70, 0.35, 1.05,   80.00),
  (orc_002, prod_mousepad,    'PROD-010', 'Mousepad Gamer XL 800x400',        3, 'UN',   59.90,  179.70, 0.55, 1.65,   18.00),
  -- ORC-003
  (orc_003, prod_ssd,         'PROD-007', 'SSD 480GB SATA III',               2, 'UN',  349.90,  699.80, 0.07, 0.14,  180.00),
  (orc_003, prod_memoria_ram, 'PROD-008', 'Memória RAM 8GB DDR4 3200MHz',     2, 'UN',  199.90,  399.80, 0.03, 0.06,   95.00),
  (orc_003, prod_webcam,      'PROD-009', 'Webcam Full HD 1080p',             1, 'UN',  219.90,  219.90, 0.18, 0.18,   90.00)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 13. ORDENS DE VENDA
-- =============================================================
INSERT INTO public.ordens_venda (
  id, numero, data_emissao, cliente_id, cotacao_id,
  status, status_faturamento,
  data_aprovacao, data_prometida_despacho,
  valor_total, po_number, ativo
) VALUES
  (
    ov_001, 'OV-2026-001', CURRENT_DATE - 9, cli_tecnomax, orc_001,
    'aprovado', 'faturado',
    CURRENT_DATE - 9, CURRENT_DATE - 6,
    6598.50, 'PO-TCM-2026-45', true
  ),
  (
    ov_002, 'OV-2026-002', CURRENT_DATE - 4, cli_digital, orc_002,
    'aprovado', 'aguardando',
    CURRENT_DATE - 4, CURRENT_DATE + 1,
    2359.50, NULL, true
  ),
  (
    ov_003, 'OV-2026-003', CURRENT_DATE - 1, cli_solucoes, NULL,
    'pendente', 'aguardando',
    NULL, NULL,
    9899.80, 'PO-CST-2026-12', true
  )
ON CONFLICT (id) DO NOTHING;

-- Itens das ordens de venda
INSERT INTO public.ordens_venda_itens (
  ordem_venda_id, produto_id,
  codigo_snapshot, descricao_snapshot,
  quantidade, unidade,
  valor_unitario, valor_total,
  peso_unitario, peso_total,
  quantidade_faturada
) VALUES
  -- OV-001
  (ov_001, prod_notebook,    'PROD-001', 'Notebook Pro 15" Core i7',        1, 'UN', 4999.90, 4999.90, 2.20, 2.20, 1),
  (ov_001, prod_monitor,     'PROD-002', 'Monitor 27" Full HD IPS',          1, 'UN', 1199.90, 1199.90, 4.50, 4.50, 1),
  (ov_001, prod_cabo_hdmi,   'PROD-006', 'Cabo HDMI 2.0 2 metros',           1, 'UN',   39.90,   39.90, 0.08, 0.08, 1),
  (ov_001, prod_mousepad,    'PROD-010', 'Mousepad Gamer XL 800x400',        1, 'UN',   59.90,   59.90, 0.55, 0.55, 1),
  (ov_001, prod_mouse,       'PROD-004', 'Mouse Óptico 6400 DPI',            2, 'UN',  139.90,  279.80, 0.12, 0.24, 2),
  -- OV-002
  (ov_002, prod_teclado,     'PROD-003', 'Teclado Mecânico Gamer RGB',       3, 'UN',  279.90,  839.70, 0.90, 2.70, 0),
  (ov_002, prod_mouse,       'PROD-004', 'Mouse Óptico 6400 DPI',            3, 'UN',  139.90,  419.70, 0.12, 0.36, 0),
  (ov_002, prod_headset,     'PROD-005', 'Headset Stereo 7.1 USB',           3, 'UN',  199.90,  599.70, 0.35, 1.05, 0),
  (ov_002, prod_mousepad,    'PROD-010', 'Mousepad Gamer XL 800x400',        3, 'UN',   59.90,  179.70, 0.55, 1.65, 0),
  -- OV-003
  (ov_003, prod_notebook,    'PROD-001', 'Notebook Pro 15" Core i7',         2, 'UN', 4999.90, 9999.80, 2.20, 4.40, 0)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 14. NOTAS FISCAIS (saída)
-- =============================================================
INSERT INTO public.notas_fiscais (
  id, tipo, numero, serie,
  chave_acesso, data_emissao,
  cliente_id, ordem_venda_id,
  modelo_documento, tipo_operacao,
  valor_total, frete_valor,
  icms_valor, ipi_valor, pis_valor, cofins_valor,
  status, forma_pagamento, condicao_pagamento,
  ativo
) VALUES
  (
    nf_001, 'saida', '000001', '1',
    '35260412345678000190550010000001001234567890',
    CURRENT_DATE - 8,
    cli_tecnomax, ov_001,
    '55', 'venda',
    6598.50, 0.00,
    791.82, 0.00, 107.98, 499.05,
    'autorizada', 'boleto', 'a_prazo',
    true
  ),
  (
    nf_002, 'saida', '000002', '1',
    '35260412345678000190550010000002001234567891',
    CURRENT_DATE - 3,
    cli_digital, ov_002,
    '55', 'venda',
    2359.50, 35.00,
    283.14, 0.00, 38.61, 178.80,
    'pendente', 'boleto', 'a_vista',
    true
  ),
  (
    nf_003, 'entrada', '654321', '1',
    '35260411222333000155550010006543211234567892',
    CURRENT_DATE - 15,
    NULL, NULL,
    '55', 'compra',
    18500.00, 350.00,
    2220.00, 0.00, 302.50, 1402.00,
    'escriturada', 'boleto', 'a_prazo',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Itens das notas fiscais
INSERT INTO public.notas_fiscais_itens (
  nota_fiscal_id, produto_id,
  cfop, ncm, cst,
  descricao,
  quantidade, unidade,
  valor_unitario, valor_total,
  icms_base, icms_aliquota, icms_valor,
  ipi_aliquota, pis_valor, cofins_valor
) VALUES
  -- NF-001 (saída)
  (nf_001, prod_notebook,   '6102', '8471.30.12', '000', 'Notebook Pro 15" Core i7',    1, 'UN', 4999.90, 4999.90, 4999.90, 12.00, 599.99, 0, 81.99, 379.99),
  (nf_001, prod_monitor,    '6102', '8528.52.20', '000', 'Monitor 27" Full HD IPS',      1, 'UN', 1199.90, 1199.90, 1199.90, 12.00, 143.99, 0, 19.64,  90.97),
  (nf_001, prod_cabo_hdmi,  '6102', '8544.42.00', '000', 'Cabo HDMI 2.0 2 metros',       1, 'UN',   39.90,   39.90,   39.90, 12.00,   4.79, 0,  0.65,   3.02),
  (nf_001, prod_mousepad,   '6102', '3926.90.40', '000', 'Mousepad Gamer XL 800x400',    1, 'UN',   59.90,   59.90,   59.90, 12.00,   7.19, 0,  0.98,   4.54),
  (nf_001, prod_mouse,      '6102', '8471.60.53', '000', 'Mouse Óptico 6400 DPI',        2, 'UN',  139.90,  279.80,  279.80, 12.00,  33.58, 0,  4.58,  21.21),
  -- NF-002 (saída)
  (nf_002, prod_teclado,    '6102', '8471.60.52', '000', 'Teclado Mecânico Gamer RGB',   3, 'UN',  279.90,  839.70,  839.70, 12.00, 100.76, 0, 13.75,  63.69),
  (nf_002, prod_mouse,      '6102', '8471.60.53', '000', 'Mouse Óptico 6400 DPI',        3, 'UN',  139.90,  419.70,  419.70, 12.00,  50.36, 0,  6.87,  31.82),
  (nf_002, prod_headset,    '6102', '8518.30.00', '000', 'Headset Stereo 7.1 USB',       3, 'UN',  199.90,  599.70,  599.70, 12.00,  71.96, 0,  9.82,  45.47),
  (nf_002, prod_mousepad,   '6102', '3926.90.40', '000', 'Mousepad Gamer XL 800x400',    3, 'UN',   59.90,  179.70,  179.70, 12.00,  21.56, 0,  2.94,  13.62),
  -- NF-003 (entrada)
  (nf_003, prod_notebook,   '1102', '8471.30.12', '000', 'Notebook Pro 15" Core i7',     4, 'UN', 3200.00, 12800.00, 12800.00, 12.00, 1536.00, 0, 209.60,  970.00),
  (nf_003, prod_monitor,    '1102', '8528.52.20', '000', 'Monitor 27" Full HD IPS',       4, 'UN',  650.00,  2600.00,  2600.00, 12.00,  312.00, 0,  42.55,  197.00),
  (nf_003, prod_ssd,        '1102', '8471.70.90', '000', 'SSD 480GB SATA III',            5, 'UN',  180.00,   900.00,   900.00, 12.00,  108.00, 0,  14.73,   68.23),
  (nf_003, prod_memoria_ram,'1102', '8473.30.49', '000', 'Memória RAM 8GB DDR4 3200MHz',  5, 'UN',   95.00,   475.00,   475.00, 12.00,   57.00, 0,   7.77,   36.00),
  (nf_003, prod_webcam,     '1102', '8525.80.29', '000', 'Webcam Full HD 1080p',           5, 'UN',   90.00,   450.00,   450.00, 12.00,   54.00, 0,   7.36,   34.10),
  (nf_003, prod_cabo_hdmi,  '1102', '8544.42.00', '000', 'Cabo HDMI 2.0 2 metros',        25, 'UN',   12.00,   300.00,   300.00, 12.00,   36.00, 0,   4.91,   22.74)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 15. COMPRAS
-- =============================================================
INSERT INTO public.compras (
  id, numero, fornecedor_id,
  data_compra, data_entrega_prevista, data_entrega_real,
  valor_produtos, frete_valor, impostos_valor, valor_total,
  status, observacoes, ativo
) VALUES
  (
    cmp_001, 'CMP-2026-001', for_distribuidora,
    CURRENT_DATE - 20, CURRENT_DATE - 12, CURRENT_DATE - 13,
    18500.00, 350.00, 3240.00, 22090.00,
    'recebido', 'Reposição de estoque programada.', true
  ),
  (
    cmp_002, 'CMP-2026-002', for_importadora,
    CURRENT_DATE - 5, CURRENT_DATE + 10, NULL,
    7650.00, 200.00, 1380.00, 9230.00,
    'confirmado', 'Pedido aguardando entrega.', true
  )
ON CONFLICT (id) DO NOTHING;

-- Itens das compras
INSERT INTO public.compras_itens (
  compra_id, produto_id,
  descricao, quantidade,
  valor_unitario, valor_total
) VALUES
  -- CMP-001
  (cmp_001, prod_notebook,    'Notebook Pro 15" Core i7',        4, 3200.00, 12800.00),
  (cmp_001, prod_monitor,     'Monitor 27" Full HD IPS',          4,  650.00,  2600.00),
  (cmp_001, prod_ssd,         'SSD 480GB SATA III',               5,  180.00,   900.00),
  (cmp_001, prod_memoria_ram, 'Memória RAM 8GB DDR4 3200MHz',     5,   95.00,   475.00),
  (cmp_001, prod_webcam,      'Webcam Full HD 1080p',              5,   90.00,   450.00),
  (cmp_001, prod_cabo_hdmi,   'Cabo HDMI 2.0 2 metros',           25,   12.00,   300.00),
  -- CMP-002
  (cmp_002, prod_teclado,     'Teclado Mecânico Gamer RGB',       20,  120.00,  2400.00),
  (cmp_002, prod_mouse,       'Mouse Óptico 6400 DPI',            30,   55.00,  1650.00),
  (cmp_002, prod_headset,     'Headset Stereo 7.1 USB',           15,   80.00,  1200.00),
  (cmp_002, prod_mousepad,    'Mousepad Gamer XL 800x400',        30,   18.00,   540.00),
  (cmp_002, prod_cabo_hdmi,   'Cabo HDMI 2.0 2 metros',           50,   12.00,   600.00),
  (cmp_002, prod_webcam,      'Webcam Full HD 1080p',             14,   90.00,  1260.00)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 16. LANÇAMENTOS FINANCEIROS
-- =============================================================
INSERT INTO public.financeiro_lancamentos (
  tipo, descricao, valor,
  data_vencimento, data_pagamento,
  status, forma_pagamento,
  cliente_id, fornecedor_id,
  conta_bancaria_id,
  parcela_numero, parcela_total,
  saldo_restante, valor_pago,
  ativo
) VALUES
  -- Contas a Receber
  (
    'receber', 'NF-000001 – Tecnomax Soluções', 6598.50,
    CURRENT_DATE + 20, NULL,
    'aberto', 'boleto',
    cli_tecnomax, NULL, conta_principal,
    1, 1, 6598.50, 0.00, true
  ),
  (
    'receber', 'NF-000002 – Digital Office (Parc. 1/2)', 1197.75,
    CURRENT_DATE + 5, NULL,
    'aberto', 'boleto',
    cli_digital, NULL, conta_principal,
    1, 2, 1197.75, 0.00, true
  ),
  (
    'receber', 'NF-000002 – Digital Office (Parc. 2/2)', 1197.75,
    CURRENT_DATE + 35, NULL,
    'aberto', 'boleto',
    cli_digital, NULL, conta_principal,
    2, 2, 1197.75, 0.00, true
  ),
  (
    'receber', 'OV-2026-003 – CorpTech (sinal)', 4949.90,
    CURRENT_DATE - 1, CURRENT_DATE - 1,
    'pago', 'transferencia',
    cli_solucoes, NULL, conta_principal,
    1, 2, 0.00, 4949.90, true
  ),
  (
    'receber', 'OV-2026-003 – CorpTech (restante)', 4949.90,
    CURRENT_DATE + 30, NULL,
    'aberto', 'boleto',
    cli_solucoes, NULL, conta_principal,
    2, 2, 4949.90, 0.00, true
  ),
  -- Contas a Pagar
  (
    'pagar', 'CMP-2026-001 – Alpha Distribuidora (Parc. 1/2)', 11045.00,
    CURRENT_DATE + 8, NULL,
    'aberto', 'boleto',
    NULL, for_distribuidora, conta_principal,
    1, 2, 11045.00, 0.00, true
  ),
  (
    'pagar', 'CMP-2026-001 – Alpha Distribuidora (Parc. 2/2)', 11045.00,
    CURRENT_DATE + 38, NULL,
    'aberto', 'boleto',
    NULL, for_distribuidora, conta_principal,
    2, 2, 11045.00, 0.00, true
  ),
  (
    'pagar', 'CMP-2026-002 – BrasilImport', 9230.00,
    CURRENT_DATE + 15, NULL,
    'aberto', 'boleto',
    NULL, for_importadora, conta_principal,
    1, 1, 9230.00, 0.00, true
  ),
  (
    'pagar', 'Aluguel – Abril/2026', 4500.00,
    CURRENT_DATE + 5, NULL,
    'aberto', 'transferencia',
    NULL, NULL, conta_principal,
    1, 1, 4500.00, 0.00, true
  ),
  (
    'pagar', 'Energia Elétrica – Março/2026', 890.00,
    CURRENT_DATE - 2, CURRENT_DATE - 2,
    'pago', 'debito_automatico',
    NULL, NULL, conta_principal,
    1, 1, 0.00, 890.00, true
  ),
  (
    'pagar', 'Folha Pagamento – Março/2026', 18500.00,
    CURRENT_DATE - 10, CURRENT_DATE - 10,
    'pago', 'transferencia',
    NULL, NULL, conta_principal,
    1, 1, 0.00, 18500.00, true
  ),
  (
    'pagar', 'Serviços de Internet e Telefonia – Abril/2026', 1200.00,
    CURRENT_DATE + 12, NULL,
    'aberto', 'debito_automatico',
    NULL, NULL, conta_principal,
    1, 1, 1200.00, 0.00, true
  )
ON CONFLICT DO NOTHING;

END $$;
