-- Remover FKs duplicadas (mantemos as originais geradas pelo Supabase)
ALTER TABLE public.compras                    DROP CONSTRAINT IF EXISTS fk_compras_fornecedor;
ALTER TABLE public.compras_itens              DROP CONSTRAINT IF EXISTS fk_compras_itens_compra;
ALTER TABLE public.compras_itens              DROP CONSTRAINT IF EXISTS fk_compras_itens_produto;
ALTER TABLE public.cotacoes_compra_itens      DROP CONSTRAINT IF EXISTS fk_cci_cotacao;
ALTER TABLE public.cotacoes_compra_itens      DROP CONSTRAINT IF EXISTS fk_cci_produto;
ALTER TABLE public.cotacoes_compra_propostas  DROP CONSTRAINT IF EXISTS fk_ccp_cotacao;
ALTER TABLE public.cotacoes_compra_propostas  DROP CONSTRAINT IF EXISTS fk_ccp_item;
ALTER TABLE public.cotacoes_compra_propostas  DROP CONSTRAINT IF EXISTS fk_ccp_fornecedor;
ALTER TABLE public.pedidos_compra             DROP CONSTRAINT IF EXISTS fk_pedidos_compra_fornecedor;
ALTER TABLE public.pedidos_compra             DROP CONSTRAINT IF EXISTS fk_pedidos_compra_cotacao;
ALTER TABLE public.pedidos_compra_itens       DROP CONSTRAINT IF EXISTS fk_pci_pedido;
ALTER TABLE public.pedidos_compra_itens       DROP CONSTRAINT IF EXISTS fk_pci_produto;

-- Garantir cascade nas relações de itens (alterando as originais quando necessário)
ALTER TABLE public.cotacoes_compra_itens     DROP CONSTRAINT IF EXISTS cotacoes_compra_itens_cotacao_compra_id_fkey;
ALTER TABLE public.cotacoes_compra_itens     ADD  CONSTRAINT cotacoes_compra_itens_cotacao_compra_id_fkey
  FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE;

ALTER TABLE public.cotacoes_compra_propostas DROP CONSTRAINT IF EXISTS cotacoes_compra_propostas_cotacao_compra_id_fkey;
ALTER TABLE public.cotacoes_compra_propostas ADD  CONSTRAINT cotacoes_compra_propostas_cotacao_compra_id_fkey
  FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE;

ALTER TABLE public.cotacoes_compra_propostas DROP CONSTRAINT IF EXISTS cotacoes_compra_propostas_item_id_fkey;
ALTER TABLE public.cotacoes_compra_propostas ADD  CONSTRAINT cotacoes_compra_propostas_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.cotacoes_compra_itens(id) ON DELETE CASCADE;

ALTER TABLE public.pedidos_compra            DROP CONSTRAINT IF EXISTS pedidos_compra_cotacao_compra_id_fkey;
ALTER TABLE public.pedidos_compra            ADD  CONSTRAINT pedidos_compra_cotacao_compra_id_fkey
  FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id) ON DELETE SET NULL;

ALTER TABLE public.compras_itens             DROP CONSTRAINT IF EXISTS compras_itens_compra_id_fkey;
ALTER TABLE public.compras_itens             ADD  CONSTRAINT compras_itens_compra_id_fkey
  FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;

ALTER TABLE public.pedidos_compra_itens      DROP CONSTRAINT IF EXISTS pedidos_compra_itens_pedido_compra_id_fkey;
ALTER TABLE public.pedidos_compra_itens      ADD  CONSTRAINT pedidos_compra_itens_pedido_compra_id_fkey
  FOREIGN KEY (pedido_compra_id) REFERENCES public.pedidos_compra(id) ON DELETE CASCADE;

-- Forçar reload do PostgREST cache
NOTIFY pgrst, 'reload schema';