import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Column } from "@/components/DataTable";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreditCard } from "lucide-react";
import type { Lancamento } from "@/types/domain";

interface Params {
  getLancamentoStatus: (l: Lancamento) => string;
  hoje: Date;
  hojeStr: string;
  onBaixaParcial: (l: Lancamento) => void;
}

export function buildFinanceiroColumns({ getLancamentoStatus, hoje, hojeStr, onBaixaParcial }: Params) {
  return [
    {
      key: "tipo",
      mobileCard: true,
      label: "Tipo",
      sortable: true,
      render: (l: Lancamento) => (
        <Badge
          variant="outline"
          className={
            l.tipo === "receber"
              ? "border-success/40 text-success bg-success/5 whitespace-nowrap"
              : "border-destructive/40 text-destructive bg-destructive/5 whitespace-nowrap"
          }
        >
          {l.tipo === "receber" ? "Receber" : "Pagar"}
        </Badge>
      ),
    },
    {
      key: "parceiro",
      mobilePrimary: true,
      label: "Pessoa",
      sortable: true,
      render: (l: Lancamento) => {
        const nome = l.tipo === "receber" ? l.clientes?.nome_razao_social : l.fornecedores?.nome_razao_social;
        if (!nome) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-medium text-sm">{nome}</span>;
      },
    },
    {
      key: "descricao",
      mobileCard: true,
      label: "Descrição",
      sortable: true,
      render: (l: Lancamento) => (
        <div className="space-y-0.5">
          <span className="text-sm">{l.descricao}</span>
          {l.parcela_numero > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono block">
              Parcela {l.parcela_numero}/{l.parcela_total}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "data_vencimento",
      mobileCard: true,
      label: "Vencimento",
      sortable: true,
      render: (l: Lancamento) => {
        const es = getLancamentoStatus(l);
        const isOverdue = es === "vencido";
        const isToday = l.data_vencimento === hojeStr;
        const [y, m, d] = l.data_vencimento.split("-").map(Number);
        const venc = new Date(y, m - 1, d);
        const diasAtraso = isOverdue
          ? Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return (
          <div className="space-y-0.5">
            <span
              className={cn(
                "text-sm",
                isOverdue ? "text-destructive font-semibold" : isToday ? "text-warning font-semibold" : "",
              )}
            >
              {venc.toLocaleDateString("pt-BR")}
            </span>
            {isOverdue && diasAtraso > 0 && (
              <span className="text-[10px] text-destructive font-medium block">{diasAtraso}d em atraso</span>
            )}
            {isToday && !isOverdue && (
              <span className="text-[10px] text-warning font-medium block">Vence hoje</span>
            )}
          </div>
        );
      },
    },
    {
      key: "valor",
      mobileCard: true,
      label: "Valor Total",
      sortable: true,
      render: (l: Lancamento) => (
        <span className="font-semibold font-mono text-sm">{formatCurrency(Number(l.valor))}</span>
      ),
    },
    {
      key: "saldo_restante",
      label: "Saldo em Aberto",
      render: (l: Lancamento) => {
        const es = getLancamentoStatus(l);
        if (es === "pago" || es === "cancelado") return <span className="text-muted-foreground text-xs">—</span>;
        const saldo = l.saldo_restante != null ? Number(l.saldo_restante) : Number(l.valor);
        if (saldo <= 0) return <span className="text-success text-xs font-mono font-semibold">Quitado</span>;
        return (
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              es === "vencido" ? "text-destructive" : es === "parcial" ? "text-warning" : "",
            )}
          >
            {formatCurrency(saldo)}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (l: Lancamento) => <StatusBadge status={getLancamentoStatus(l)} />,
    },
    {
      key: "origem",
      label: "Origem",
      hidden: true,
      render: (l: Lancamento) => {
        if (l.nota_fiscal_id)
          return (
            <Badge
              variant="outline"
              className="text-xs border-primary/30 text-primary bg-primary/5 whitespace-nowrap"
            >
              NF Fiscal
            </Badge>
          );
        if (l.documento_pai_id) return <Badge variant="outline" className="text-xs whitespace-nowrap">Parcelamento</Badge>;
        return <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">Manual</Badge>;
      },
    },
    {
      key: "forma_pagamento",
      label: "Forma Pgto",
      hidden: true,
      render: (l: Lancamento) =>
        l.forma_pagamento ? <span className="text-xs">{l.forma_pagamento}</span> : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "conta_bancaria",
      label: "Banco/Conta",
      hidden: true,
      render: (l: Lancamento) => {
        if (!l.contas_bancarias) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs">{l.contas_bancarias.bancos?.nome} - {l.contas_bancarias.descricao}</span>;
      },
    },
    {
      key: "acoes_rapidas",
      label: "Ações",
      sortable: false,
      render: (l: Lancamento) => {
        const es = getLancamentoStatus(l);
        const canBaixa = es !== "pago" && es !== "cancelado";
        if (!canBaixa) return null;

        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5 whitespace-nowrap"
            aria-label={`Baixar lançamento: ${l.descricao}`}
            onClick={(e) => {
              e.stopPropagation();
              onBaixaParcial(l);
            }}
          >
            <CreditCard className="h-3 w-3" /> Baixar
          </Button>
        );
      },
    },
  ] satisfies Column<Lancamento>[];
}
