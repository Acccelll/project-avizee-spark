import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Trophy } from "lucide-react";
import type { CotacaoCompra, CotacaoSummary } from "./cotacaoCompraTypes";
import { statusLabels } from "./cotacaoCompraTypes";

interface CotacaoCompraTableProps {
  data: CotacaoCompra[];
  loading: boolean;
  summaries: Record<string, CotacaoSummary>;
  onView: (c: CotacaoCompra) => void;
  onEdit: (c: CotacaoCompra) => void;
}

export function CotacaoCompraTable({ data, loading, summaries, onView, onEdit }: CotacaoCompraTableProps) {
  const columns = [
    {
      key: "numero",
      label: "Cotação",
      render: (c: CotacaoCompra) => (
        <div>
          <span className="font-mono text-xs font-semibold text-primary">{c.numero}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(c.data_cotacao).toLocaleDateString("pt-BR")}
          </p>
        </div>
      ),
    },
    {
      key: "itens",
      label: "Itens",
      render: (c: CotacaoCompra) => {
        const s = summaries[c.id];
        if (!s) return <span className="text-muted-foreground/40 text-xs font-mono">—</span>;
        return <span className="font-mono text-sm font-semibold">{s.itens_count}</span>;
      },
    },
    {
      key: "fornecedores",
      label: "Fornecedores",
      render: (c: CotacaoCompra) => {
        const s = summaries[c.id];
        if (!s) return <span className="text-muted-foreground/40 text-xs">—</span>;
        if (s.fornecedores_count === 0) {
          return <span className="text-xs text-muted-foreground italic">Sem propostas</span>;
        }
        return (
          <div>
            <span className="text-sm font-mono font-semibold">{s.fornecedores_count}</span>
            {s.vencedor_nome ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                <Trophy className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[110px]">{s.vencedor_nome}</span>
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5">Sem vencedor</p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (c: CotacaoCompra) => (
        <StatusBadge status={c.status} label={statusLabels[c.status] || c.status} />
      ),
    },
    {
      key: "data_validade",
      label: "Validade",
      render: (c: CotacaoCompra) =>
        c.data_validade
          ? new Date(c.data_validade).toLocaleDateString("pt-BR")
          : "—",
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      moduleKey="cotacoes_compra"
      showColumnToggle={true}
      onView={onView}
      onEdit={onEdit}
      emptyTitle="Nenhuma cotação de compra encontrada"
      emptyDescription="Tente ajustar os filtros ou crie uma nova cotação de compra."
    />
  );
}
