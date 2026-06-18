import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import type { Column } from "@/components/DataTable";
import { formatCurrency, formatDate } from "@/lib/format";
import { getOrigemKey, getOrigemLabel } from "@/lib/financeiro";
import type { LancamentoComStatus } from "./types";

export const conciliacaoColumns: Column<LancamentoComStatus>[] = [
  {
    key: "data_vencimento",
    label: "Data",
    sortable: true,
    render: (l) => <span className="text-sm whitespace-nowrap">{formatDate(l.data_vencimento)}</span>,
  },
  {
    key: "descricao",
    mobilePrimary: true,
    label: "Descrição",
    sortable: true,
    render: (l) => <span className="text-sm">{l.descricao}</span>,
  },
  {
    key: "valor",
    label: "Valor",
    sortable: true,
    render: (l) => (
      <span className={`font-mono font-semibold text-sm ${l.tipo === "receber" ? "text-success" : "text-destructive"}`}>
        {l.tipo === "receber" ? "+" : "-"}{formatCurrency(Math.abs(l.valor))}
      </span>
    ),
  },
  {
    key: "tipo",
    label: "Tipo",
    sortable: true,
    render: (l) => (
      <Badge variant={l.tipo === "receber" ? "default" : "secondary"} className="text-[10px] whitespace-nowrap">
        {l.tipo === "receber" ? "A Receber" : "A Pagar"}
      </Badge>
    ),
  },
  {
    key: "statusConciliacao",
    label: "Conciliação",
    sortable: true,
    render: (l) => (
      <div className="flex flex-col gap-0.5">
        <StatusBadge status={l.statusConciliacao} />
        {l.divergencia !== null && (
          <span className="text-[10px] text-warning font-mono">Δ {formatCurrency(l.divergencia)}</span>
        )}
      </div>
    ),
  },
  {
    key: "status",
    label: "Status Financeiro",
    sortable: true,
    render: (l) => <StatusBadge status={l.status} />,
  },
  {
    key: "origem",
    label: "Origem",
    hidden: true,
    render: (l) => {
      const key = getOrigemKey(l);
      const label = getOrigemLabel(l);
      const className =
        key === "nf"
          ? "text-xs border-primary/30 text-primary bg-primary/5 whitespace-nowrap"
          : key === "manual"
          ? "text-xs text-muted-foreground whitespace-nowrap"
          : "text-xs whitespace-nowrap";
      return <Badge variant="outline" className={className}>{label}</Badge>;
    },
  },
  {
    key: "forma_pagamento",
    label: "Forma Pgto",
    hidden: true,
    render: (l) =>
      l.forma_pagamento ? (
        <span className="text-xs">{l.forma_pagamento}</span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    key: "conta_bancaria",
    label: "Banco/Conta",
    hidden: true,
    render: (l) => {
      if (!l.contas_bancarias) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span className="text-xs">
          {l.contas_bancarias.bancos?.nome} — {l.contas_bancarias.descricao}
        </span>
      );
    },
  },
];