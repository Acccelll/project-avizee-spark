import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { RowActions } from "@/components/list/RowActions";
import {
  PackageCheck,
  SendHorizontal,
} from "lucide-react";
import { formatCurrency, formatDate, calculateDaysBetween } from "@/lib/format";
import type { PedidoCompra } from "./pedidoCompraTypes";
import { pedidoNumero } from "./pedidoCompraTypes";
import { useActionLock } from "@/hooks/useActionLock";

const ENTREGA_ALERTA_DIAS = 3;
const TERMINAL_STATUS_PC = ["recebido", "cancelado"];

function EntregaCell({ dataEntrega, status }: { dataEntrega: string | null; status: string }) {
  if (!dataEntrega) return <span className="text-muted-foreground text-xs">—</span>;
  if (TERMINAL_STATUS_PC.includes(status)) {
    return <span className="text-xs">{formatDate(dataEntrega)}</span>;
  }
  const daysLeft = calculateDaysBetween(new Date(), dataEntrega);
  if (daysLeft < 0) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-destructive font-medium">{formatDate(dataEntrega)}</span>
        <StatusBadge status="atrasado" />
      </span>
    );
  }
  if (daysLeft <= ENTREGA_ALERTA_DIAS) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-warning font-medium">{formatDate(dataEntrega)}</span>
        <StatusBadge status="proximo_vencimento" label={`${daysLeft}d restantes`} />
      </span>
    );
  }
  return <span className="text-xs">{formatDate(dataEntrega)}</span>;
}

interface PedidoCompraTableProps {
  data: PedidoCompra[];
  loading: boolean;
  statusLabels: Record<string, string>;
  onView: (p: PedidoCompra) => void;
  onEdit: (p: PedidoCompra) => void;
  onSend: (p: PedidoCompra) => void;
  onReceive: (p: PedidoCompra) => void;
}

export function PedidoCompraTable({
  data,
  loading,
  statusLabels,
  onView,
  onEdit,
  onSend,
  onReceive,
}: PedidoCompraTableProps) {
  const sendLock = useActionLock();
  const receiveLock = useActionLock();
  const columns = [
    {
      key: "id",
      label: "Nº Pedido",
      sortable: true,
      render: (p: PedidoCompra) => (
        <span className="font-mono text-xs font-semibold text-primary">{pedidoNumero(p)}</span>
      ),
    },
    {
      key: "fornecedor",
      label: "Fornecedor",
      render: (p: PedidoCompra) => (
        <span className="font-medium text-sm">{p.fornecedores?.nome_razao_social || "—"}</span>
      ),
    },
    {
      key: "data_pedido",
      label: "Data Pedido",
      sortable: true,
      render: (p: PedidoCompra) => <span className="text-xs">{formatDate(p.data_pedido)}</span>,
    },
    {
      key: "data_entrega_prevista",
      label: "Entrega Prevista",
      render: (p: PedidoCompra) => (
        <EntregaCell dataEntrega={p.data_entrega_prevista} status={p.status} />
      ),
    },
    {
      key: "condicao_pagamento",
      label: "Condição de Pagamento",
      hidden: true,
      render: (p: PedidoCompra) => (
        <span className="text-xs text-muted-foreground">{p.condicao_pagamento || "—"}</span>
      ),
    },
    {
      key: "valor_total",
      label: "Total",
      sortable: true,
      render: (p: PedidoCompra) => (
        <span className="font-semibold font-mono text-sm">{formatCurrency(Number(p.valor_total || 0))}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (p: PedidoCompra) => (
        <StatusBadge status={p.status} label={statusLabels[p.status] || p.status} />
      ),
    },
    {
      key: "recebimento",
      label: "Recebimento",
      render: (p: PedidoCompra) => {
        if (p.status === "recebido") return <StatusBadge status="recebido" />;
        if (p.status === "parcialmente_recebido") return <StatusBadge status="recebido_parcial" />;
        if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(p.status)) {
          return <StatusBadge status="aguardando" />;
        }
        if (p.status === "cancelado") return <span className="text-xs text-muted-foreground">—</span>;
        return <StatusBadge status="rascunho" />;
      },
    },
    {
      key: "cotacao_origem",
      label: "Cotação Origem",
      hidden: true,
      render: (p: PedidoCompra) =>
        p.cotacao_compra_id ? (
          <span className="text-xs font-mono text-muted-foreground">{String(p.cotacao_compra_id).slice(-6)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Avulso</span>
        ),
    },
    {
      key: "acoes_pc",
      label: "Ações",
      sortable: false,
      render: (p: PedidoCompra) => {
        const canSend = p.status === "aprovado";
        const canReceive = ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"].includes(p.status);
        if (!canSend && !canReceive) return null;
        const primary = canSend
          ? { label: "Enviar ao fornecedor", icon: SendHorizontal, onClick: () => sendLock.run(() => onSend(p)), disabled: sendLock.pending }
          : { label: "Receber", icon: PackageCheck, onClick: () => receiveLock.run(() => onReceive(p)), disabled: receiveLock.pending };
        const secondary = canSend && canReceive
          ? [{ label: "Receber", icon: PackageCheck, onClick: () => receiveLock.run(() => onReceive(p)), disabled: receiveLock.pending }]
          : [];
        return <RowActions primary={primary} secondary={secondary} />;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      moduleKey="pedidos-compra"
      showColumnToggle={true}
      onView={onView}
      onEdit={onEdit}
      emptyTitle="Nenhum pedido de compra encontrado"
      emptyDescription="Tente ajustar os filtros ou crie um novo pedido de compra."
    />
  );
}
