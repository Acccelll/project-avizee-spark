import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { formatCurrency } from "@/lib/format";
import { buildDrilldownUrl } from "@/lib/dashboard/drilldown";
import type { DailyPoint, TopPoint } from "@/pages/dashboard/hooks/types";

export type KpiMetricKey = "receber" | "pagar" | "saldo" | "estoque";

export interface KpiMetricPayload {
  title: string;
  daily: DailyPoint[];
  top: TopPoint[];
}

interface KpiDetailDrawerProps {
  /** Métrica ativa; `null` mantém o drawer fechado. */
  metric: KpiMetricKey | null;
  payload: KpiMetricPayload | null;
  onClose: () => void;
}

/**
 * Drawer único compartilhado pelos KPIs financeiros e de estoque
 * (Receber / Pagar / Saldo / Estoque). Extraído de `Index.tsx` para
 * encolher a página principal e facilitar evolução futura (ex.: mais
 * métricas, novos formatos de visualização).
 */
export function KpiDetailDrawer({ metric, payload, onClose }: KpiDetailDrawerProps) {
  const navigate = useNavigate();

  const goAndClose = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <ViewDrawerV2
      open={!!metric}
      onClose={onClose}
      title={payload?.title ?? "Detalhes"}
      tabs={
        payload && metric
          ? [
              {
                value: "evolucao",
                label: "Evolução diária",
                content: (
                  <div className="space-y-3">
                    {payload.daily.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...payload.daily]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dia" />
                            <YAxis />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Line
                              dataKey="valor"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Sem dados para o período selecionado.
                      </p>
                    )}
                    {metric === "receber" && (
                      <DrawerLink
                        onClick={() =>
                          goAndClose(buildDrilldownUrl({ kind: "financeiro:receber-aberto" }))
                        }
                      >
                        Ver todos os títulos →
                      </DrawerLink>
                    )}
                    {metric === "pagar" && (
                      <DrawerLink
                        onClick={() =>
                          goAndClose(buildDrilldownUrl({ kind: "financeiro:pagar-aberto" }))
                        }
                      >
                        Ver todos os títulos →
                      </DrawerLink>
                    )}
                    {metric === "saldo" && (
                      <DrawerLink onClick={() => goAndClose("/fluxo-caixa")}>
                        Abrir fluxo de caixa →
                      </DrawerLink>
                    )}
                  </div>
                ),
              },
              {
                value: "top",
                label: "Top itens",
                content: (
                  <div className="space-y-3">
                    {payload.top.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[...payload.top]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Bar dataKey="valor" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Sem dados disponíveis.
                      </p>
                    )}
                    {metric === "estoque" && (
                      <DrawerLink onClick={() => goAndClose("/estoque")}>
                        Ver estoque completo →
                      </DrawerLink>
                    )}
                  </div>
                ),
              },
            ]
          : []
      }
    />
  );
}

function DrawerLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        {children}
      </button>
    </div>
  );
}