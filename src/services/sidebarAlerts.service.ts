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
}

export async function fetchSidebarAlertsRaw(
  options: { isAdmin?: boolean } = {},
): Promise<SidebarAlertsRaw> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const plus3 = new Date(now);
  plus3.setDate(now.getDate() + 3);
  const dueSoon = plus3.toISOString().slice(0, 10);

  const [
    { count: vencidos },
    { count: vencer },
    estoqueBaixoRes,
    { count: orcPendentes },
    { count: nfRej },
    { count: nfEntrada },
  ] = await Promise.all([
    supabase
      .from("financeiro_lancamentos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", ["aberto", "vencido"])
      .lt("data_vencimento", today),
    supabase
      .from("financeiro_lancamentos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("status", "aberto")
      .gte("data_vencimento", today)
      .lte("data_vencimento", dueSoon),
    supabase.rpc("count_estoque_baixo" as never),
    supabase
      .from("orcamentos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", ["pendente", "aguardando_aprovacao", "em_analise"]),
    supabase
      .from("notas_fiscais")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("status", "rejeitada"),
    supabase
      .from("nfe_distribuicao")
      .select("*", { count: "exact", head: true })
      .eq("status_manifestacao", "sem_manifestacao"),
  ]);

  const baixoCount = Number((estoqueBaixoRes as { data?: number | null }).data ?? 0);

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

  return {
    financeiroVencidos: vencidos || 0,
    financeiroVencer: vencer || 0,
    estoqueBaixo: baixoCount,
    orcamentosPendentes: orcPendentes || 0,
    nfRejeitadas: nfRej || 0,
    nfeEntradaSemManifestacao: nfEntrada || 0,
    filaEmailDLQ,
  };
}