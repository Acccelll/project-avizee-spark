import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FiscalInternalStatusBadge, FiscalSefazStatusBadge } from "@/components/fiscal/FiscalStatusBadges";
import { formatCurrency, formatDate } from "@/lib/format";
import type { NotaFiscal } from "@/types/domain";

const modeloLabels: Record<string, string> = {
  "55": "NF-e",
  "65": "NFC-e",
  "57": "CT-e",
  "67": "CT-e OS",
  nfse: "NFS-e",
  outro: "Outro",
};

const origemLabels: Record<string, string> = {
  manual: "Manual",
  pedido: "Pedido",
  xml_importado: "Importação XML",
};

export interface BuildFiscalColumnsOpts {
  /** Quando a URL filtra por tipo (`?tipo=entrada|saida`), a coluna "Tipo" some. */
  tipoParam: string | null;
  /** Label dinâmico da coluna 2 — "Fornecedor" para entrada, "Cliente" para saída. */
  parceiroLabel: string;
  /** Empilha badges ERP+SEFAZ no mobile. */
  isMobile: boolean;
}

/**
 * Renderiza ERP + SEFAZ empilhados como sub-pill no mobile (header do card),
 * só ERP no desktop (SEFAZ vai em coluna própria).
 */
function renderFiscalStatus(n: NotaFiscal, isMobile: boolean) {
  if (isMobile) {
    return (
      <div className="flex flex-col items-end gap-1">
        <FiscalInternalStatusBadge status={n.status} />
        <FiscalSefazStatusBadge
          status={n.status_sefaz || "nao_enviada"}
          className="text-[10px] px-1.5 py-0"
        />
      </div>
    );
  }
  return <FiscalInternalStatusBadge status={n.status} />;
}

/**
 * Factory das colunas da DataTable em `/fiscal`. Extraída de
 * `src/pages/Fiscal.tsx` (Frente 1 — decomposição). Comportamento idêntico.
 */
export function buildFiscalColumns(opts: BuildFiscalColumnsOpts) {
  const { tipoParam, parceiroLabel, isMobile } = opts;
  return [
    {
      key: "numero",
      label: "Nº Nota",
      serverSortable: true,
      render: (n: NotaFiscal) => (
        <span className="font-mono text-sm font-bold text-primary">{n.numero}</span>
      ),
    },
    {
      key: "parceiro",
      label: parceiroLabel,
      render: (n: NotaFiscal) => {
        // Devolução de saída: NF de entrada gerada a partir de uma saída
        // carrega `cliente_id` (não `fornecedor_id`), por isso resolvemos
        // explicitamente este caso para mostrar o nome certo.
        const nome =
          n.tipo === "entrada" && n.tipo_operacao === "devolucao" && n.clientes?.nome_razao_social
            ? n.clientes.nome_razao_social
            : n.tipo === "entrada"
              ? n.fornecedores?.nome_razao_social || "—"
              : n.clientes?.nome_razao_social || "—";
        return <span className="font-medium">{nome}</span>;
      },
    },
    {
      key: "data_emissao",
      label: "Emissão",
      sortable: true,
      serverSortable: true,
      render: (n: NotaFiscal) => formatDate(n.data_emissao),
    },
    {
      key: "status",
      label: "Status ERP",
      render: (n: NotaFiscal) => renderFiscalStatus(n, isMobile),
    },
    {
      key: "valor_total",
      label: "Total",
      sortable: true,
      serverSortable: true,
      render: (n: NotaFiscal) => (
        <span className="font-semibold font-mono">{formatCurrency(Number(n.valor_total))}</span>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      hidden: !!tipoParam,
      render: (n: NotaFiscal) => (n.tipo === "entrada" ? "Entrada" : "Saída"),
    },
    {
      key: "serie",
      label: "Série",
      hidden: true,
      render: (n: NotaFiscal) => (
        <span className="font-mono text-xs text-muted-foreground">{n.serie || "1"}</span>
      ),
    },
    {
      key: "modelo",
      label: "Modelo",
      // U1: modelo é informação chave em página que mistura NF-e/NFC-e/CT-e/NFS-e.
      render: (n: NotaFiscal) => {
        const td = (n as { tipo_documento?: string }).tipo_documento;
        const label =
          td === "nfse"
            ? "NFS-e"
            : td === "cte"
              ? "CT-e"
              : modeloLabels[n.modelo_documento || "55"] || n.modelo_documento;
        const cls =
          td === "nfse"
            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
            : td === "cte"
              ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30"
              : "bg-muted text-foreground/80 border-border";
        return (
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${cls}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "operacao",
      label: "Operação",
      // U2: visibilidade de devolução vs operação normal sem precisar abrir a NF.
      render: (n: NotaFiscal) => {
        if ((n.tipo_operacao || "normal") === "devolucao")
          return <span className="text-xs text-warning font-medium">Devolução</span>;
        return <span className="text-xs text-muted-foreground">Normal</span>;
      },
    },
    {
      key: "chave_acesso",
      label: "Chave de Acesso",
      hidden: true,
      render: (n: NotaFiscal) =>
        n.chave_acesso ? (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-xs text-muted-foreground cursor-help">
                    {n.chave_acesso.length > 12
                      ? `${n.chave_acesso.slice(0, 8)}…${n.chave_acesso.slice(-4)}`
                      : n.chave_acesso}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs">{n.chave_acesso}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(n.chave_acesso!);
                toast.success("Chave copiada");
              }}
              aria-label="Copiar chave de acesso"
              title="Copiar chave de acesso"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "ov",
      label: "Pedido Vinc.",
      hidden: true,
      render: (n: NotaFiscal) =>
        n.ordens_venda?.numero ? (
          <span className="font-mono text-xs">{n.ordens_venda.numero}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "origem",
      label: "Origem",
      hidden: true,
      render: (n: NotaFiscal) => (
        <Badge variant="outline" className="text-xs capitalize">
          {origemLabels[n.origem || "manual"] || n.origem || "Manual"}
        </Badge>
      ),
    },
    {
      key: "status_sefaz",
      label: "Status SEFAZ",
      render: (n: NotaFiscal) => (
        <FiscalSefazStatusBadge status={n.status_sefaz || "nao_enviada"} />
      ),
    },
  ];
}