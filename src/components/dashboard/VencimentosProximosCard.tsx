import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface VencimentoItem {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  tipo: string;
  clientes?: { nome_razao_social: string } | null;
  fornecedores?: { nome_razao_social: string } | null;
}

function useVencimentos() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInicio = hoje.toISOString().split("T")[0];
  const data30 = new Date(hoje);
  data30.setDate(hoje.getDate() + 30);
  const dataFim = data30.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["dashboard-vencimentos-proximos", dataInicio, dataFim],
    queryFn: async (): Promise<VencimentoItem[]> => {
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select(
          "id, descricao, valor, data_vencimento, tipo, clientes(nome_razao_social), fornecedores(nome_razao_social)",
        )
        .eq("ativo", true)
        .in("status", ["aberto", "parcial"])
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", dataFim)
        .order("data_vencimento", { ascending: true })
        .limit(20);

      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as VencimentoItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function faixaDias(dataStr: string): 7 | 15 | 30 {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataStr + "T00:00:00");
  const diff = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 7) return 7;
  if (diff <= 15) return 15;
  return 30;
}

interface VencimentosProximosCardProps {
  className?: string;
}

export function VencimentosProximosCard({ className }: VencimentosProximosCardProps) {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useVencimentos();

  const grupos = { 7: [] as VencimentoItem[], 15: [] as VencimentoItem[], 30: [] as VencimentoItem[] };
  items.forEach((item) => {
    grupos[faixaDias(item.data_vencimento)].push(item);
  });

  return (
    <div className={cn("bg-card rounded-xl border flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-warning" />
          Vencimentos Próximos
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-primary hover:text-primary"
          onClick={() => navigate("/financeiro")}
        >
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <span className="text-xs text-muted-foreground">Nenhum vencimento nos próximos 30 dias.</span>
        </div>
      ) : (
        <div className="divide-y divide-border/60 overflow-y-auto max-h-[320px]">
          {([7, 15, 30] as const).map((faixa) => {
            const grupo = grupos[faixa];
            if (grupo.length === 0) return null;
            return (
              <div key={faixa}>
                <div className="px-4 py-1.5 bg-muted/30 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {faixa === 7 ? "Próximos 7 dias" : faixa === 15 ? "8 a 15 dias" : "16 a 30 dias"}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {grupo.length}
                  </Badge>
                </div>
                {grupo.map((item) => {
                  const nome =
                    item.tipo === "receber"
                      ? item.clientes?.nome_razao_social
                      : item.fornecedores?.nome_razao_social;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate("/financeiro")}
                    >
                      <span className="shrink-0">
                        {item.tipo === "receber" ? (
                          <TrendingUp className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{item.descricao}</p>
                        {nome && (
                          <p className="text-[11px] text-muted-foreground truncate">{nome}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-xs font-mono font-semibold",
                            item.tipo === "receber" ? "text-success" : "text-destructive",
                          )}
                        >
                          {formatCurrency(Number(item.valor))}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(item.data_vencimento)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
