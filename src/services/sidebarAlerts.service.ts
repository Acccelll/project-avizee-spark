import { supabase } from "@/integrations/supabase/client";

export interface SidebarAlertsRaw {
  financeiroVencidos: number;
  financeiroVencer: number;
  estoqueBaixo: number;
  orcamentosPendentes: number;
  /** NF-e com status `rejeitada` (action requerida do usuário fiscal) */
  nfRejeitadas: number;
  /** NF-e de entrada baixadas via DistDF-e ainda sem manifestação do destinatário */
  nfeEntradaSemManifestacao: number;
  /**
   * Mensagens em DLQ de e-mail (auth_emails_dlq + transactional_emails_dlq).
   * Apenas admin enxerga este alerta — para não-admins fica em 0.
   */
  filaEmailDLQ: number;
  /** Pedidos de Compra em rascunho/em aprovação/pendente */
  pedidosCompraPendentes: number;
  /** Notas Fiscais de Entrada com status pendente */
  nfeEntradaPendentes: number;
  /** Notas Fiscais de Entrada com gera_financeiro=true e forma_pagamento vazia */
  notasSemFormaPagamento: number;
  /**
   * Chamados de suporte ainda não triados (spec §33.2: "itens realmente
   * pendentes de triagem/atenção, não todos os chamados abertos"). Só admin
   * enxerga — para não-admins fica em 0.
   */
  suportePendentesAdmin: number;
  /** Chamados de suporte do próprio usuário aguardando resposta dele (spec §33.2). */
  suporteAguardandoResposta: number;
}

export async function fetchSidebarAlertsRaw(
  options: { isAdmin?: boolean } = {},
): Promise<SidebarAlertsRaw> {
  // Consolida 6 contadores em 1 round-trip (RPC server-side, polling 90s).
  // CURRENT_DATE no servidor evita drift de timezone entre clientes.
  const { data, error } = await supabase.rpc("sidebar_alerts_kpis");
  if (error) throw error;
  const row = ((Array.isArray(data) ? data[0] : data) ?? {}) as {
    financeiro_vencidos?: number;
    financeiro_vencer?: number;
    estoque_baixo?: number;
    orcamentos_pendentes?: number;
    nf_rejeitadas?: number;
    nfe_sem_manifestacao?: number;
    pedidos_compra_pendentes?: number;
    nfe_entrada_pendentes?: number;
    notas_sem_forma_pagamento?: number;
  };

  // Fila DLQ — só admin tem GRANT na RPC; para os demais a chamada é pulada.
  let filaEmailDLQ = 0;
  if (options.isAdmin) {
    try {
      const { data: filas } = await (
        supabase.rpc as unknown as (
          name: string,
          args?: Record<string, unknown>,
        ) => Promise<{
          data: { queue_name: string; total_messages: number }[] | null;
          error: { message: string } | null;
        }>
      )("email_queue_metrics", {});
      filaEmailDLQ = (filas ?? [])
        .filter((f) => f.queue_name.endsWith("_dlq"))
        .reduce((s, f) => s + Number(f.total_messages || 0), 0);
    } catch {
      filaEmailDLQ = 0;
    }
  }

  // Chamados de suporte — consultas leves e independentes (sem RPC dedicada,
  // não dá pra somar em sidebar_alerts_kpis sem migration): admin vê quantos
  // ainda não foram triados; qualquer usuário vê quantos dos seus próprios
  // chamados estão aguardando a resposta dele.
  let suportePendentesAdmin = 0;
  if (options.isAdmin) {
    const { count } = await supabase
      .from("suporte_chamados")
      .select("id", { count: "exact", head: true })
      .eq("status", "aberto");
    suportePendentesAdmin = count ?? 0;
  }

  let suporteAguardandoResposta = 0;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (uid) {
    const { count } = await supabase
      .from("suporte_chamados")
      .select("id", { count: "exact", head: true })
      .eq("solicitante_id", uid)
      .eq("status", "aguardando_usuario");
    suporteAguardandoResposta = count ?? 0;
  }

  return {
    financeiroVencidos: row.financeiro_vencidos ?? 0,
    financeiroVencer: row.financeiro_vencer ?? 0,
    estoqueBaixo: row.estoque_baixo ?? 0,
    orcamentosPendentes: row.orcamentos_pendentes ?? 0,
    nfRejeitadas: row.nf_rejeitadas ?? 0,
    nfeEntradaSemManifestacao: row.nfe_sem_manifestacao ?? 0,
    filaEmailDLQ,
    pedidosCompraPendentes: row.pedidos_compra_pendentes ?? 0,
    nfeEntradaPendentes: row.nfe_entrada_pendentes ?? 0,
    notasSemFormaPagamento: row.notas_sem_forma_pagamento ?? 0,
    suportePendentesAdmin,
    suporteAguardandoResposta,
  };
}