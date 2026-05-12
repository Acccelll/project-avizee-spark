-- Consolidação de RPCs duplicadas: remove sobrecargas legadas não chamadas
-- pelo frontend nem por edge functions. As versões canônicas (com mais
-- parâmetros) cobrem todos os usos.

DROP FUNCTION IF EXISTS public.acao_cliente_orcamento(p_token uuid, p_acao text);
DROP FUNCTION IF EXISTS public.ajustar_estoque_manual(p_produto_id uuid, p_tipo text, p_quantidade numeric, p_motivo text);
DROP FUNCTION IF EXISTS public.marcar_remessa_entregue(p_remessa_id uuid, p_data_entrega timestamptz);