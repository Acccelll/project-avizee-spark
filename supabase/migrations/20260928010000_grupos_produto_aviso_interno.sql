-- Aviso interno por grupo de produto: lembrete para a equipe exibido no
-- orçamento, na visualização do pedido e no relatório Pedidos a Faturar
-- sempre que houver item do grupo. Nunca vai para o PDF nem para o link do
-- cliente. Primeiro uso: agulhas exigem informar o lote no envio.
ALTER TABLE public.grupos_produto ADD COLUMN IF NOT EXISTS aviso_interno text;
COMMENT ON COLUMN public.grupos_produto.aviso_interno IS
  'Lembrete interno exibido quando um orçamento/pedido tem item do grupo (ex.: "Informar o lote"). Não aparece para o cliente.';

UPDATE public.grupos_produto
   SET aviso_interno = 'Informar o lote'
 WHERE nome = 'AGULHA' AND aviso_interno IS NULL;
