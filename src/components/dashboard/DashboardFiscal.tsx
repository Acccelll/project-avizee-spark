/**
 * @legacy DashboardFiscal — parallel fiscal KPI component.
 *
 * This component is NOT rendered by the main Dashboard (Index.tsx). The active
 * fiscal block is {@link FiscalBlock}, which reads from `useDashboardFiscalData`.
 *
 * DashboardFiscal uses model_documento="55" / status="autorizada" vocabulary,
 * which differs from FiscalBlock's "confirmada"/"pendente"/"cancelada" vocabulary.
 *
 * Keep this file for future reference but do NOT render it in the main flow
 * until the fiscal status vocabulary is unified.
 */

import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiFiscal {
  totalEmitidas: number;
  valorTotalMes: number;
  tempoMedioAutorizacaoMin: number | null;
  percentualRejeicoes: number;
}

async function fetchKpisFiscais(): Promise<KpiFiscal> {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const ultimas24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // NF-e emitidas no mês
  const { data: nfesMes, error: errMes } = await supabase
    .from("notas_fiscais")
    .select("id, valor_total, status, created_at, data_emissao")
    .eq("modelo_documento", "55")
    .eq("ativo", true)
    .gte("data_emissao", inicioMes);

  if (errMes) throw new Error(errMes.message);

  const emitidas = (nfesMes ?? []).filter((n) => n.status === "autorizada");
  const totalEmitidas = emitidas.length;
  const valorTotalMes = emitidas.reduce((s, n) => s + (n.valor_total ?? 0), 0);

  // Rejeições
  const rejeitadas = (nfesMes ?? []).filter((n) => n.status === "rejeitada").length;
  const total = (nfesMes ?? []).length;
  const percentualRejeicoes = total > 0 ? (rejeitadas / total) * 100 : 0;

  // Tempo médio de autorização últimas 24h (simplificado: diferença created_at → data_emissao)
  const { data: recentes } = await supabase
    .from("notas_fiscais")
    .select("created_at, data_emissao")
    .eq("modelo_documento", "55")
    .eq("status", "autorizada")
    .gte("created_at", ultimas24h);

  let tempoMedioAutorizacaoMin: number | null = null;
  if (recentes && recentes.length > 0) {
    const tempos = recentes
      .map((n) => {
        if (!n.created_at || !n.data_emissao) return null;
        const diff = new Date(n.data_emissao).getTime() - new Date(n.created_at).getTime();
        return diff / 60000; // ms → minutos
      })
      .filter((t): t is number => t !== null && t >= 0);

    if (tempos.length > 0) {
      tempoMedioAutorizacaoMin = tempos.reduce((s, t) => s + t, 0) / tempos.length;
    }
  }

  return { totalEmitidas, valorTotalMes, tempoMedioAutorizacaoMin, percentualRejeicoes };
}

export function DashboardFiscal() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["dashboard-fiscal-kpis"],
    queryFn: fetchKpisFiscais,
    staleTime: 5 * 60 * 1000,
  });

  const cards = [
    {
      label: "NF-e emitidas no mês",
      value: isLoading ? null : formatNumber(kpis?.totalEmitidas ?? 0),
      sub: isLoading ? null : formatCurrency(kpis?.valorTotalMes ?? 0),
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Tempo médio de autorização (24h)",
      value: isLoading
        ? null
        : kpis?.tempoMedioAutorizacaoMin != null
          ? `${kpis.tempoMedioAutorizacaoMin.toFixed(1)} min`
          : "N/D",
      sub: "últimas 24 horas",
      icon: Clock,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      label: "Taxa de rejeição",
      value: isLoading ? null : `${(kpis?.percentualRejeicoes ?? 0).toFixed(1)}%`,
      sub: "NF-e rejeitadas pela SEFAZ",
      icon: (kpis?.percentualRejeicoes ?? 0) > 5 ? AlertTriangle : TrendingUp,
      color: (kpis?.percentualRejeicoes ?? 0) > 5 ? "text-destructive" : "text-success",
      bg: (kpis?.percentualRejeicoes ?? 0) > 5 ? "bg-destructive/10" : "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border bg-card p-4"
          >
            <div className={`rounded-lg p-2.5 ${card.bg}`}>
              <Icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{card.label}</p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-20" />
              ) : (
                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              )}
              {card.sub && (
                <p className="text-[11px] text-muted-foreground">{card.sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
