import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const LISTA_PEDIDOS = "/orcamentos?aba=pedidos";

/**
 * `/pedidos/:id` era a tela da Ordem de Venda. O pedido agora vive no
 * orçamento: abre o orçamento de origem da OV (`cotacao_id`) ou, sem ele,
 * a aba "Pedidos em aberto".
 */
export default function PedidoLegadoRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = id
        ? await supabase.from("ordens_venda").select("cotacao_id").eq("id", id).maybeSingle()
        : { data: null };
      if (!ativo) return;
      navigate(data?.cotacao_id ? `/orcamentos/${data.cotacao_id}` : LISTA_PEDIDOS, { replace: true });
    })();
    return () => {
      ativo = false;
    };
  }, [id, navigate]);

  return null;
}
