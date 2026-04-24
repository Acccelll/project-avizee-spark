-- 1. Coluna para rastrear último envio por e-mail
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS ultimo_envio_email TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.orcamentos.ultimo_envio_email IS
  'Data/hora do último envio bem-sucedido do orçamento por e-mail ao cliente.';

-- 2. View pública de orçamento estendida (mantém GRANT existente p/ anon)
CREATE OR REPLACE VIEW public.orcamentos_public_view AS
SELECT
  id, numero, data_orcamento, validade, valor_total,
  observacoes, status, prazo_entrega, prazo_pagamento,
  frete_tipo, cliente_snapshot, public_token, ativo,
  desconto, imposto_st, imposto_ipi, frete_valor, outras_despesas,
  modalidade, servico_frete, peso_total, quantidade_total,
  pagamento
FROM public.orcamentos
WHERE public_token IS NOT NULL AND ativo = true;

GRANT SELECT ON public.orcamentos_public_view TO anon;

-- 3. View pública institucional (apenas dados não-sensíveis)
CREATE OR REPLACE VIEW public.empresa_config_public_view AS
SELECT
  razao_social,
  nome_fantasia,
  cnpj,
  inscricao_estadual,
  inscricao_municipal,
  telefone,
  whatsapp,
  email,
  site,
  logradouro,
  numero,
  complemento,
  bairro,
  cidade,
  uf,
  cep,
  logo_url,
  simbolo_url,
  marca_texto,
  marca_subtitulo,
  cor_primaria,
  cor_secundaria
FROM public.empresa_config
LIMIT 1;

COMMENT ON VIEW public.empresa_config_public_view IS
  'Dados institucionais públicos da empresa (logo, endereço, contatos). Usado por páginas públicas como /orcamento-publico.';

GRANT SELECT ON public.empresa_config_public_view TO anon;
GRANT SELECT ON public.empresa_config_public_view TO authenticated;
