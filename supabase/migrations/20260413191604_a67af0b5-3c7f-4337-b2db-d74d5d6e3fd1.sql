-- =====================================================================
-- 1. ÍNDICES EM CHAVES ESTRANGEIRAS E COLUNAS DE FILTRO FREQUENTE
-- =====================================================================

-- ── orcamentos ──
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id ON public.orcamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_vendedor_id ON public.orcamentos (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos (status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data_orcamento ON public.orcamentos (data_orcamento);

-- ── orcamentos_itens ──
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_orcamento_id ON public.orcamentos_itens (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_produto_id ON public.orcamentos_itens (produto_id);

-- ── ordens_venda ──
CREATE INDEX IF NOT EXISTS idx_ordens_venda_cliente_id ON public.ordens_venda (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_vendedor_id ON public.ordens_venda (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_status ON public.ordens_venda (status);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_cotacao_id ON public.ordens_venda (cotacao_id);

-- ── ordens_venda_itens ──
CREATE INDEX IF NOT EXISTS idx_ordens_venda_itens_ordem_venda_id ON public.ordens_venda_itens (ordem_venda_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_itens_produto_id ON public.ordens_venda_itens (produto_id);

-- ── notas_fiscais ──
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_fornecedor_id ON public.notas_fiscais (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_cliente_id ON public.notas_fiscais (cliente_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_ordem_venda_id ON public.notas_fiscais (ordem_venda_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status ON public.notas_fiscais (status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_data_emissao ON public.notas_fiscais (data_emissao);

-- ── notas_fiscais_itens ──
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_nota_fiscal_id ON public.notas_fiscais_itens (nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_produto_id ON public.notas_fiscais_itens (produto_id);

-- ── financeiro_lancamentos ──
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_cliente_id ON public.financeiro_lancamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_fornecedor_id ON public.financeiro_lancamentos (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_conta_bancaria_id ON public.financeiro_lancamentos (conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_nota_fiscal_id ON public.financeiro_lancamentos (nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_status ON public.financeiro_lancamentos (status);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_data_vencimento ON public.financeiro_lancamentos (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_tipo ON public.financeiro_lancamentos (tipo);

-- ── financeiro_baixas ──
CREATE INDEX IF NOT EXISTS idx_financeiro_baixas_lancamento_id ON public.financeiro_baixas (lancamento_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_baixas_conta_bancaria_id ON public.financeiro_baixas (conta_bancaria_id);

-- ── estoque_movimentos ──
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_produto_id ON public.estoque_movimentos (produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_documento_id ON public.estoque_movimentos (documento_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_usuario_id ON public.estoque_movimentos (usuario_id);

-- ── pedidos_compra ──
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_fornecedor_id ON public.pedidos_compra (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status ON public.pedidos_compra (status);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_cotacao_compra_id ON public.pedidos_compra (cotacao_compra_id);

-- ── pedidos_compra_itens ──
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_itens_pedido_compra_id ON public.pedidos_compra_itens (pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_itens_produto_id ON public.pedidos_compra_itens (produto_id);

-- ── compras ──
CREATE INDEX IF NOT EXISTS idx_compras_fornecedor_id ON public.compras (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_status ON public.compras (status);

-- ── compras_itens ──
CREATE INDEX IF NOT EXISTS idx_compras_itens_compra_id ON public.compras_itens (compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_itens_produto_id ON public.compras_itens (produto_id);

-- ── remessas ──
CREATE INDEX IF NOT EXISTS idx_remessas_cliente_id ON public.remessas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_remessas_transportadora_id ON public.remessas (transportadora_id);
CREATE INDEX IF NOT EXISTS idx_remessas_nota_fiscal_id ON public.remessas (nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_remessas_ordem_venda_id ON public.remessas (ordem_venda_id);

-- ── clientes ──
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON public.clientes (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_grupo_economico_id ON public.clientes (grupo_economico_id);

-- ── fornecedores ──
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON public.fornecedores (cpf_cnpj);

-- ── produtos ──
CREATE INDEX IF NOT EXISTS idx_produtos_grupo_id ON public.produtos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON public.produtos (sku);


-- =====================================================================
-- 2. CHECK CONSTRAINTS DE DOMÍNIO
-- Nota: ao adicionar novos valores a um domínio, atualize a constraint
-- correspondente aqui também.
-- =====================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orcamentos_status') THEN
    ALTER TABLE public.orcamentos ADD CONSTRAINT chk_orcamentos_status
      CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'reprovado', 'cancelado', 'expirado'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordens_venda_status') THEN
    ALTER TABLE public.ordens_venda ADD CONSTRAINT chk_ordens_venda_status
      CHECK (status IN ('pendente', 'aprovada', 'em_producao', 'faturada', 'cancelada'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordens_venda_status_faturamento') THEN
    ALTER TABLE public.ordens_venda ADD CONSTRAINT chk_ordens_venda_status_faturamento
      CHECK (status_faturamento IN ('aguardando', 'parcial', 'faturado'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notas_fiscais_status') THEN
    ALTER TABLE public.notas_fiscais ADD CONSTRAINT chk_notas_fiscais_status
      CHECK (status IN ('pendente', 'autorizada', 'cancelada', 'denegada', 'inutilizada'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_financeiro_lancamentos_status') THEN
    ALTER TABLE public.financeiro_lancamentos ADD CONSTRAINT chk_financeiro_lancamentos_status
      CHECK (status IN ('aberto', 'pago', 'cancelado', 'vencido'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_financeiro_lancamentos_tipo') THEN
    ALTER TABLE public.financeiro_lancamentos ADD CONSTRAINT chk_financeiro_lancamentos_tipo
      CHECK (tipo IN ('pagar', 'receber'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedidos_compra_status') THEN
    ALTER TABLE public.pedidos_compra ADD CONSTRAINT chk_pedidos_compra_status
      CHECK (status IN ('rascunho', 'enviado', 'parcial', 'recebido', 'cancelado'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cotacoes_compra_status') THEN
    ALTER TABLE public.cotacoes_compra ADD CONSTRAINT chk_cotacoes_compra_status
      CHECK (status IN ('aberta', 'fechada', 'cancelada'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_remessas_status_transporte') THEN
    ALTER TABLE public.remessas ADD CONSTRAINT chk_remessas_status_transporte
      CHECK (status_transporte IN ('pendente', 'coletado', 'em_transito', 'entregue', 'devolvido'));
  END IF;
END $$;


-- =====================================================================
-- 3. TRIGGER DE SINCRONIZAÇÃO DE ESTOQUE
-- produtos.estoque_atual é um campo desnormalizado mantido em sincronia
-- via trigger. NÃO atualize este campo diretamente no código da aplicação.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.sync_produto_estoque_atual()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.produtos
    SET estoque_atual = NEW.saldo_atual
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estoque_movimentos_sync ON public.estoque_movimentos;

CREATE TRIGGER trg_estoque_movimentos_sync
  AFTER INSERT OR UPDATE ON public.estoque_movimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_produto_estoque_atual();