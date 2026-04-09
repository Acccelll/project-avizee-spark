
-- =============================================================
-- 1. UTILITY: updated_at trigger function
-- =============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================================
-- 2. PROFILES
-- =============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  cargo TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- 3. USER ROLES
-- =============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- 4. USER PERMISSIONS
-- =============================================================
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_permissions_select" ON public.user_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_permissions_admin_insert" ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_permissions_admin_update" ON public.user_permissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_permissions_admin_delete" ON public.user_permissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- 5. APP CONFIGURACOES
-- =============================================================
CREATE TABLE public.app_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config_select" ON public.app_configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_config_insert" ON public.app_configuracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "app_config_update" ON public.app_configuracoes FOR UPDATE TO authenticated USING (true);
CREATE TRIGGER trg_app_config_updated_at BEFORE UPDATE ON public.app_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 6. EMPRESA CONFIG
-- =============================================================
CREATE TABLE public.empresa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  telefone TEXT,
  email TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_config_select" ON public.empresa_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresa_config_insert" ON public.empresa_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "empresa_config_update" ON public.empresa_config FOR UPDATE TO authenticated USING (true);
CREATE TRIGGER trg_empresa_config_updated_at BEFORE UPDATE ON public.empresa_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 7. GRUPOS ECONOMICOS
-- =============================================================
CREATE TABLE public.grupos_economicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  empresa_matriz_id UUID,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grupos_economicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ge_select" ON public.grupos_economicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "ge_insert" ON public.grupos_economicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ge_update" ON public.grupos_economicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ge_delete" ON public.grupos_economicos FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 8. CLIENTES
-- =============================================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa TEXT NOT NULL DEFAULT 'J',
  nome_razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  contato TEXT,
  prazo_padrao INTEGER DEFAULT 30,
  limite_credito NUMERIC(15,2) DEFAULT 0,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  pais TEXT DEFAULT 'Brasil',
  caixa_postal TEXT,
  observacoes TEXT,
  grupo_economico_id UUID REFERENCES public.grupos_economicos(id),
  tipo_relacao_grupo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 9. FORNECEDORES
-- =============================================================
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa TEXT NOT NULL DEFAULT 'J',
  nome_razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  contato TEXT,
  prazo_padrao INTEGER DEFAULT 30,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  pais TEXT DEFAULT 'Brasil',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 10. TRANSPORTADORAS
-- =============================================================
CREATE TABLE public.transportadoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  modalidade TEXT DEFAULT 'rodoviario',
  prazo_medio TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transportadoras_select" ON public.transportadoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "transportadoras_insert" ON public.transportadoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "transportadoras_update" ON public.transportadoras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "transportadoras_delete" ON public.transportadoras FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_transportadoras_updated_at BEFORE UPDATE ON public.transportadoras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 11. CLIENTE_TRANSPORTADORAS
-- =============================================================
CREATE TABLE public.cliente_transportadoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  transportadora_id UUID NOT NULL REFERENCES public.transportadoras(id) ON DELETE CASCADE,
  prioridade INTEGER DEFAULT 1,
  modalidade TEXT,
  prazo_medio TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cliente_transportadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_select" ON public.cliente_transportadoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct_insert" ON public.cliente_transportadoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ct_update" ON public.cliente_transportadoras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ct_delete" ON public.cliente_transportadoras FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 12. GRUPOS PRODUTO
-- =============================================================
CREATE TABLE public.grupos_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grupos_produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gp_select" ON public.grupos_produto FOR SELECT TO authenticated USING (true);
CREATE POLICY "gp_insert" ON public.grupos_produto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gp_update" ON public.grupos_produto FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gp_delete" ON public.grupos_produto FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 13. PRODUTOS
-- =============================================================
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  codigo_interno TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  grupo_id UUID REFERENCES public.grupos_produto(id),
  unidade_medida TEXT DEFAULT 'UN',
  preco_custo NUMERIC(15,4) DEFAULT 0,
  preco_venda NUMERIC(15,4) DEFAULT 0,
  estoque_atual NUMERIC(15,4) DEFAULT 0,
  estoque_minimo NUMERIC(15,4) DEFAULT 0,
  estoque_reservado NUMERIC(15,4) DEFAULT 0,
  estoque_ideal NUMERIC(15,4),
  ponto_reposicao NUMERIC(15,4),
  ncm TEXT,
  cst TEXT,
  cfop_padrao TEXT,
  peso NUMERIC(10,4) DEFAULT 0,
  eh_composto BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "produtos_insert" ON public.produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "produtos_update" ON public.produtos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "produtos_delete" ON public.produtos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 14. PRODUTO COMPOSICOES
-- =============================================================
CREATE TABLE public.produto_composicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_pai_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  produto_filho_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade NUMERIC(15,4) NOT NULL DEFAULT 1,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produto_composicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_select" ON public.produto_composicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc_insert" ON public.produto_composicoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pc_update" ON public.produto_composicoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pc_delete" ON public.produto_composicoes FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 15. PRODUTOS_FORNECEDORES
-- =============================================================
CREATE TABLE public.produtos_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  eh_principal BOOLEAN DEFAULT false,
  descricao_fornecedor TEXT,
  referencia_fornecedor TEXT,
  unidade_fornecedor TEXT,
  lead_time_dias INTEGER DEFAULT 0,
  preco_compra NUMERIC(15,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos_fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pf_select" ON public.produtos_fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "pf_insert" ON public.produtos_fornecedores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pf_update" ON public.produtos_fornecedores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pf_delete" ON public.produtos_fornecedores FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 16. PRECOS ESPECIAIS
-- =============================================================
CREATE TABLE public.precos_especiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  preco_especial NUMERIC(15,4) NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.precos_especiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_select" ON public.precos_especiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "pe_insert" ON public.precos_especiais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pe_update" ON public.precos_especiais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pe_delete" ON public.precos_especiais FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 17. FORMAS PAGAMENTO
-- =============================================================
CREATE TABLE public.formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  prazo_dias INTEGER DEFAULT 0,
  parcelas INTEGER DEFAULT 1,
  intervalos_dias JSONB DEFAULT '[]',
  gera_financeiro BOOLEAN DEFAULT true,
  tipo TEXT DEFAULT 'boleto',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fp_select" ON public.formas_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "fp_insert" ON public.formas_pagamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fp_update" ON public.formas_pagamento FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fp_delete" ON public.formas_pagamento FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 18. BANCOS
-- =============================================================
CREATE TABLE public.bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'banco',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bancos_select" ON public.bancos FOR SELECT TO authenticated USING (true);
CREATE POLICY "bancos_insert" ON public.bancos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bancos_update" ON public.bancos FOR UPDATE TO authenticated USING (true);

-- =============================================================
-- 19. CONTAS BANCARIAS
-- =============================================================
CREATE TABLE public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_id UUID REFERENCES public.bancos(id),
  descricao TEXT NOT NULL,
  agencia TEXT,
  conta TEXT,
  titular TEXT,
  saldo_atual NUMERIC(15,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_select" ON public.contas_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_insert" ON public.contas_bancarias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cb_update" ON public.contas_bancarias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cb_delete" ON public.contas_bancarias FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_contas_bancarias_updated_at BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 20. CONTAS CONTABEIS
-- =============================================================
CREATE TABLE public.contas_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  natureza TEXT DEFAULT 'devedora',
  aceita_lancamento BOOLEAN DEFAULT true,
  conta_pai_id UUID REFERENCES public.contas_contabeis(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_contabeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_select" ON public.contas_contabeis FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_insert" ON public.contas_contabeis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cc_update" ON public.contas_contabeis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cc_delete" ON public.contas_contabeis FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 21. ORCAMENTOS
-- =============================================================
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  data_orcamento DATE DEFAULT CURRENT_DATE,
  validade DATE,
  valor_total NUMERIC(15,2) DEFAULT 0,
  quantidade_total NUMERIC(15,4) DEFAULT 0,
  peso_total NUMERIC(15,4) DEFAULT 0,
  status TEXT DEFAULT 'rascunho',
  pagamento TEXT,
  prazo_pagamento TEXT,
  prazo_entrega TEXT,
  modalidade TEXT,
  frete_tipo TEXT,
  frete_valor NUMERIC(15,2) DEFAULT 0,
  observacoes TEXT,
  observacoes_internas TEXT,
  cliente_snapshot JSONB,
  public_token UUID,
  vendedor_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos_select" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "orcamentos_insert" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orcamentos_update" ON public.orcamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "orcamentos_delete" ON public.orcamentos FOR DELETE TO authenticated USING (true);
-- Public access via token
CREATE POLICY "orcamentos_public_token" ON public.orcamentos FOR SELECT TO anon USING (public_token IS NOT NULL);
CREATE TRIGGER trg_orcamentos_updated_at BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 22. ORCAMENTOS ITENS
-- =============================================================
CREATE TABLE public.orcamentos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  codigo_snapshot TEXT,
  descricao_snapshot TEXT,
  variacao TEXT,
  quantidade NUMERIC(15,4) DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario NUMERIC(15,4) DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  peso_unitario NUMERIC(10,4) DEFAULT 0,
  peso_total NUMERIC(10,4) DEFAULT 0,
  custo_unitario NUMERIC(15,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oi_select" ON public.orcamentos_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "oi_insert" ON public.orcamentos_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "oi_update" ON public.orcamentos_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "oi_delete" ON public.orcamentos_itens FOR DELETE TO authenticated USING (true);
-- Public access for shared orcamentos
CREATE POLICY "oi_public" ON public.orcamentos_itens FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND public_token IS NOT NULL));

-- =============================================================
-- 23. ORDENS VENDA
-- =============================================================
CREATE TABLE public.ordens_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  data_emissao DATE DEFAULT CURRENT_DATE,
  cliente_id UUID REFERENCES public.clientes(id),
  cotacao_id UUID REFERENCES public.orcamentos(id),
  status TEXT DEFAULT 'pendente',
  status_faturamento TEXT DEFAULT 'aguardando',
  data_aprovacao DATE,
  data_prometida_despacho DATE,
  prazo_despacho_dias INTEGER,
  valor_total NUMERIC(15,2) DEFAULT 0,
  observacoes TEXT,
  po_number TEXT,
  data_po_cliente DATE,
  vendedor_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ordens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ov_select" ON public.ordens_venda FOR SELECT TO authenticated USING (true);
CREATE POLICY "ov_insert" ON public.ordens_venda FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ov_update" ON public.ordens_venda FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ov_delete" ON public.ordens_venda FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_ordens_venda_updated_at BEFORE UPDATE ON public.ordens_venda FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 24. ORDENS VENDA ITENS
-- =============================================================
CREATE TABLE public.ordens_venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_venda_id UUID NOT NULL REFERENCES public.ordens_venda(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  codigo_snapshot TEXT,
  descricao_snapshot TEXT,
  variacao TEXT,
  quantidade NUMERIC(15,4) DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario NUMERIC(15,4) DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  peso_unitario NUMERIC(10,4) DEFAULT 0,
  peso_total NUMERIC(10,4) DEFAULT 0,
  quantidade_faturada NUMERIC(15,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ordens_venda_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ovi_select" ON public.ordens_venda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "ovi_insert" ON public.ordens_venda_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ovi_update" ON public.ordens_venda_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ovi_delete" ON public.ordens_venda_itens FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 25. NOTAS FISCAIS
-- =============================================================
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT DEFAULT 'entrada',
  numero TEXT,
  serie TEXT DEFAULT '1',
  chave_acesso TEXT,
  data_emissao DATE DEFAULT CURRENT_DATE,
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  cliente_id UUID REFERENCES public.clientes(id),
  ordem_venda_id UUID REFERENCES public.ordens_venda(id),
  conta_contabil_id UUID REFERENCES public.contas_contabeis(id),
  modelo_documento TEXT DEFAULT '55',
  tipo_operacao TEXT,
  nf_referenciada_id UUID REFERENCES public.notas_fiscais(id),
  valor_total NUMERIC(15,2) DEFAULT 0,
  frete_valor NUMERIC(15,2) DEFAULT 0,
  icms_valor NUMERIC(15,2) DEFAULT 0,
  ipi_valor NUMERIC(15,2) DEFAULT 0,
  pis_valor NUMERIC(15,2) DEFAULT 0,
  cofins_valor NUMERIC(15,2) DEFAULT 0,
  icms_st_valor NUMERIC(15,2) DEFAULT 0,
  desconto_valor NUMERIC(15,2) DEFAULT 0,
  outras_despesas NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  forma_pagamento TEXT,
  condicao_pagamento TEXT DEFAULT 'a_vista',
  movimenta_estoque BOOLEAN DEFAULT true,
  gera_financeiro BOOLEAN DEFAULT true,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_select" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "nf_insert" ON public.notas_fiscais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nf_update" ON public.notas_fiscais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "nf_delete" ON public.notas_fiscais FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_notas_fiscais_updated_at BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 26. NOTAS FISCAIS ITENS
-- =============================================================
CREATE TABLE public.notas_fiscais_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id UUID NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  cfop TEXT,
  ncm TEXT,
  cst TEXT,
  descricao TEXT,
  quantidade NUMERIC(15,4) DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  valor_unitario NUMERIC(15,4) DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  icms_base NUMERIC(15,2) DEFAULT 0,
  icms_aliquota NUMERIC(5,2) DEFAULT 0,
  icms_valor NUMERIC(15,2) DEFAULT 0,
  ipi_aliquota NUMERIC(5,2) DEFAULT 0,
  ipi_valor NUMERIC(15,2) DEFAULT 0,
  pis_aliquota NUMERIC(5,2) DEFAULT 0,
  pis_valor NUMERIC(15,2) DEFAULT 0,
  cofins_aliquota NUMERIC(5,2) DEFAULT 0,
  cofins_valor NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nfi_select" ON public.notas_fiscais_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "nfi_insert" ON public.notas_fiscais_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nfi_update" ON public.notas_fiscais_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "nfi_delete" ON public.notas_fiscais_itens FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 27. FINANCEIRO LANCAMENTOS
-- =============================================================
CREATE TABLE public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'pagar',
  descricao TEXT,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'aberto',
  forma_pagamento TEXT,
  banco TEXT,
  cartao TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id),
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  conta_contabil_id UUID REFERENCES public.contas_contabeis(id),
  funcionario_id UUID,
  parcela_numero INTEGER,
  parcela_total INTEGER,
  documento_pai_id UUID REFERENCES public.financeiro_lancamentos(id),
  saldo_restante NUMERIC(15,2),
  valor_pago NUMERIC(15,2),
  tipo_baixa TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fl_select" ON public.financeiro_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fl_insert" ON public.financeiro_lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fl_update" ON public.financeiro_lancamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fl_delete" ON public.financeiro_lancamentos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_financeiro_lancamentos_updated_at BEFORE UPDATE ON public.financeiro_lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 28. FINANCEIRO BAIXAS
-- =============================================================
CREATE TABLE public.financeiro_baixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  valor_pago NUMERIC(15,2) NOT NULL,
  data_baixa DATE NOT NULL,
  forma_pagamento TEXT,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financeiro_baixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_select" ON public.financeiro_baixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "fb_insert" ON public.financeiro_baixas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fb_update" ON public.financeiro_baixas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fb_delete" ON public.financeiro_baixas FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 29. ESTOQUE MOVIMENTOS
-- =============================================================
CREATE TABLE public.estoque_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  quantidade NUMERIC(15,4) NOT NULL,
  saldo_anterior NUMERIC(15,4) DEFAULT 0,
  saldo_atual NUMERIC(15,4) DEFAULT 0,
  motivo TEXT,
  documento_tipo TEXT,
  documento_id UUID,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "em_select" ON public.estoque_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "em_insert" ON public.estoque_movimentos FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================
-- 30. CAIXA MOVIMENTOS
-- =============================================================
CREATE TABLE public.caixa_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(15,2) NOT NULL,
  saldo_anterior NUMERIC(15,2) DEFAULT 0,
  saldo_atual NUMERIC(15,2) DEFAULT 0,
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  forma_pagamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm_select" ON public.caixa_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cm_insert" ON public.caixa_movimentos FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================
-- 31. PEDIDOS COMPRA
-- =============================================================
CREATE TABLE public.pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  data_pedido DATE DEFAULT CURRENT_DATE,
  data_entrega_prevista DATE,
  data_entrega_real DATE,
  valor_total NUMERIC(15,2) DEFAULT 0,
  frete_valor NUMERIC(15,2) DEFAULT 0,
  condicao_pagamento TEXT,
  condicoes_pagamento TEXT,
  status TEXT DEFAULT 'rascunho',
  observacoes TEXT,
  cotacao_compra_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pco_select" ON public.pedidos_compra FOR SELECT TO authenticated USING (true);
CREATE POLICY "pco_insert" ON public.pedidos_compra FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pco_update" ON public.pedidos_compra FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pco_delete" ON public.pedidos_compra FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_pedidos_compra_updated_at BEFORE UPDATE ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 32. PEDIDOS COMPRA ITENS
-- =============================================================
CREATE TABLE public.pedidos_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_compra_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  quantidade NUMERIC(15,4) DEFAULT 1,
  preco_unitario NUMERIC(15,4) DEFAULT 0,
  subtotal NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pci_select" ON public.pedidos_compra_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "pci_insert" ON public.pedidos_compra_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pci_update" ON public.pedidos_compra_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pci_delete" ON public.pedidos_compra_itens FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 33. COTACOES COMPRA
-- =============================================================
CREATE TABLE public.cotacoes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  data_cotacao DATE DEFAULT CURRENT_DATE,
  data_validade DATE,
  status TEXT DEFAULT 'aberta',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cotacoes_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cco_select" ON public.cotacoes_compra FOR SELECT TO authenticated USING (true);
CREATE POLICY "cco_insert" ON public.cotacoes_compra FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cco_update" ON public.cotacoes_compra FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cco_delete" ON public.cotacoes_compra FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_cotacoes_compra_updated_at BEFORE UPDATE ON public.cotacoes_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK now that cotacoes_compra exists
ALTER TABLE public.pedidos_compra ADD CONSTRAINT fk_pedidos_compra_cotacao FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id);

-- =============================================================
-- 34. COTACOES COMPRA ITENS
-- =============================================================
CREATE TABLE public.cotacoes_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_compra_id UUID NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  quantidade NUMERIC(15,4) DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cotacoes_compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cci_select" ON public.cotacoes_compra_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "cci_insert" ON public.cotacoes_compra_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cci_update" ON public.cotacoes_compra_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cci_delete" ON public.cotacoes_compra_itens FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 35. COTACOES COMPRA PROPOSTAS
-- =============================================================
CREATE TABLE public.cotacoes_compra_propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_compra_id UUID NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.cotacoes_compra_itens(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id),
  preco_unitario NUMERIC(15,4) DEFAULT 0,
  prazo_entrega_dias INTEGER,
  observacoes TEXT,
  selecionado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cotacoes_compra_propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccp_select" ON public.cotacoes_compra_propostas FOR SELECT TO authenticated USING (true);
CREATE POLICY "ccp_insert" ON public.cotacoes_compra_propostas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ccp_update" ON public.cotacoes_compra_propostas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ccp_delete" ON public.cotacoes_compra_propostas FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 36. COMPRAS
-- =============================================================
CREATE TABLE public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  data_compra DATE DEFAULT CURRENT_DATE,
  data_entrega_prevista DATE,
  data_entrega_real DATE,
  valor_produtos NUMERIC(15,2) DEFAULT 0,
  frete_valor NUMERIC(15,2) DEFAULT 0,
  impostos_valor NUMERIC(15,2) DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'rascunho',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras_select" ON public.compras FOR SELECT TO authenticated USING (true);
CREATE POLICY "compras_insert" ON public.compras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "compras_update" ON public.compras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "compras_delete" ON public.compras FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_compras_updated_at BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 37. COMPRAS ITENS
-- =============================================================
CREATE TABLE public.compras_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  descricao TEXT,
  quantidade NUMERIC(15,4) DEFAULT 1,
  valor_unitario NUMERIC(15,4) DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compras_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci_select" ON public.compras_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "ci_insert" ON public.compras_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ci_update" ON public.compras_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ci_delete" ON public.compras_itens FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 38. REMESSAS
-- =============================================================
CREATE TABLE public.remessas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id),
  transportadora_id UUID REFERENCES public.transportadoras(id),
  servico TEXT,
  codigo_rastreio TEXT,
  data_postagem DATE,
  previsao_entrega DATE,
  status_transporte TEXT DEFAULT 'pendente',
  peso NUMERIC(10,4),
  volumes INTEGER DEFAULT 1,
  valor_frete NUMERIC(15,2) DEFAULT 0,
  observacoes TEXT,
  ordem_venda_id UUID REFERENCES public.ordens_venda(id),
  pedido_compra_id UUID REFERENCES public.pedidos_compra(id),
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.remessas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remessas_select" ON public.remessas FOR SELECT TO authenticated USING (true);
CREATE POLICY "remessas_insert" ON public.remessas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "remessas_update" ON public.remessas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "remessas_delete" ON public.remessas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_remessas_updated_at BEFORE UPDATE ON public.remessas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 39. REMESSA EVENTOS
-- =============================================================
CREATE TABLE public.remessa_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  local TEXT,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.remessa_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "re_select" ON public.remessa_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "re_insert" ON public.remessa_eventos FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================
-- 40. FUNCIONARIOS
-- =============================================================
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  cargo TEXT,
  departamento TEXT,
  data_admissao DATE,
  data_demissao DATE,
  salario_base NUMERIC(15,2) DEFAULT 0,
  tipo_contrato TEXT DEFAULT 'clt',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "func_select" ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "func_insert" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "func_update" ON public.funcionarios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "func_delete" ON public.funcionarios FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_funcionarios_updated_at BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 41. FOLHA PAGAMENTO
-- =============================================================
CREATE TABLE public.folha_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  salario_base NUMERIC(15,2) DEFAULT 0,
  proventos NUMERIC(15,2) DEFAULT 0,
  descontos NUMERIC(15,2) DEFAULT 0,
  valor_liquido NUMERIC(15,2) DEFAULT 0,
  observacoes TEXT,
  status TEXT DEFAULT 'rascunho',
  financeiro_gerado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.folha_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_select" ON public.folha_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "folha_insert" ON public.folha_pagamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "folha_update" ON public.folha_pagamento FOR UPDATE TO authenticated USING (true);

-- =============================================================
-- 42. CLIENTE REGISTROS COMUNICACAO
-- =============================================================
CREATE TABLE public.cliente_registros_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'nota',
  assunto TEXT,
  conteudo TEXT,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  responsavel_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cliente_registros_comunicacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crc_select" ON public.cliente_registros_comunicacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "crc_insert" ON public.cliente_registros_comunicacao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crc_update" ON public.cliente_registros_comunicacao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "crc_delete" ON public.cliente_registros_comunicacao FOR DELETE TO authenticated USING (true);

-- =============================================================
-- 43. AUDITORIA LOGS
-- =============================================================
CREATE TABLE public.auditoria_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  acao TEXT NOT NULL,
  registro_id TEXT,
  usuario_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.auditoria_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.auditoria_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================
-- 44. IMPORTACAO LOTES
-- =============================================================
CREATE TABLE public.importacao_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  arquivo_nome TEXT,
  total_registros INTEGER DEFAULT 0,
  registros_sucesso INTEGER DEFAULT 0,
  registros_erro INTEGER DEFAULT 0,
  erros JSONB,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.importacao_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "il_select" ON public.importacao_lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "il_insert" ON public.importacao_lotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "il_update" ON public.importacao_lotes FOR UPDATE TO authenticated USING (true);
CREATE TRIGGER trg_importacao_lotes_updated_at BEFORE UPDATE ON public.importacao_lotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 45. IMPORTACAO LOGS
-- =============================================================
CREATE TABLE public.importacao_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.importacao_lotes(id) ON DELETE CASCADE,
  nivel TEXT DEFAULT 'info',
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.importacao_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ilog_select" ON public.importacao_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ilog_insert" ON public.importacao_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================
-- 46. STAGING TABLES (for data import)
-- =============================================================
CREATE TABLE public.stg_compras_xml (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.importacao_lotes(id) ON DELETE CASCADE,
  dados JSONB,
  status TEXT DEFAULT 'pendente',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stg_compras_xml ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scx_select" ON public.stg_compras_xml FOR SELECT TO authenticated USING (true);
CREATE POLICY "scx_insert" ON public.stg_compras_xml FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "scx_update" ON public.stg_compras_xml FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.stg_estoque_inicial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.importacao_lotes(id) ON DELETE CASCADE,
  dados JSONB,
  status TEXT DEFAULT 'pendente',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stg_estoque_inicial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sei_select" ON public.stg_estoque_inicial FOR SELECT TO authenticated USING (true);
CREATE POLICY "sei_insert" ON public.stg_estoque_inicial FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sei_update" ON public.stg_estoque_inicial FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.stg_faturamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.importacao_lotes(id) ON DELETE CASCADE,
  dados JSONB,
  status TEXT DEFAULT 'pendente',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stg_faturamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sf_select" ON public.stg_faturamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "sf_insert" ON public.stg_faturamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sf_update" ON public.stg_faturamento FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.stg_financeiro_aberto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES public.importacao_lotes(id) ON DELETE CASCADE,
  dados JSONB,
  status TEXT DEFAULT 'pendente',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stg_financeiro_aberto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sfa_select" ON public.stg_financeiro_aberto FOR SELECT TO authenticated USING (true);
CREATE POLICY "sfa_insert" ON public.stg_financeiro_aberto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sfa_update" ON public.stg_financeiro_aberto FOR UPDATE TO authenticated USING (true);

-- =============================================================
-- 47. STORAGE BUCKET
-- =============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('dbavizee', 'dbavizee', true);

CREATE POLICY "dbavizee_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'dbavizee');
CREATE POLICY "dbavizee_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dbavizee');
CREATE POLICY "dbavizee_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'dbavizee');
CREATE POLICY "dbavizee_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'dbavizee');
