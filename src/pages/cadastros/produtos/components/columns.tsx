import type { Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";

export interface Produto {
  id: string;
  sku: string;
  codigo_interno: string;
  nome: string;
  descricao: string;
  grupo_id: string;
  unidade_medida: string;
  preco_custo: number;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  ncm: string;
  cst: string;
  cfop_padrao: string;
  peso: number;
  eh_composto: boolean;
  tipo_item: "produto" | "insumo";
  ativo: boolean;
  created_at: string;
}

type SituacaoEstoque = "normal" | "atencao" | "critico" | "zerado";

function getSituacaoEstoque(p: Pick<Produto, "estoque_atual" | "estoque_minimo">): SituacaoEstoque {
  const atual = Number(p.estoque_atual || 0);
  const minimo = Number(p.estoque_minimo || 0);
  if (atual <= 0) return "zerado";
  if (minimo > 0 && atual <= minimo) return "critico";
  if (minimo > 0 && atual <= minimo * 1.2) return "atencao";
  return "normal";
}

const situacaoEstoqueConfig: Record<SituacaoEstoque, { label: string; statusBadge: string; textClass: string }> = {
  normal:  { label: "Normal",            statusBadge: "confirmado", textClass: "text-foreground"  },
  atencao: { label: "Em atenção",         statusBadge: "pendente",   textClass: "text-warning"     },
  critico: { label: "Abaixo do mínimo",  statusBadge: "cancelado",  textClass: "text-destructive" },
  zerado:  { label: "Sem estoque",       statusBadge: "cancelado",  textClass: "text-destructive" },
};

export const produtoColumns: Column<Produto>[] = [
  {
    key: "codigo_interno",
    label: "Código",
    sortable: true,
    render: (p: Produto) => (
      <span className="font-mono text-xs text-muted-foreground">
        {p.codigo_interno || p.sku || "—"}
      </span>
    ),
  },
  {
    key: "nome",
    mobilePrimary: true,
    label: "Produto",
    sortable: true,
    render: (p: Produto) => (
      <div>
        <span className="font-medium text-sm">{p.nome}</span>
        {p.sku && (
          <p className="text-[11px] text-muted-foreground font-mono leading-tight">{p.sku}</p>
        )}
      </div>
    ),
  },
  {
    key: "unidade_medida",
    label: "UN",
    render: (p: Produto) => (
      <span className="text-xs text-muted-foreground">{p.unidade_medida || "UN"}</span>
    ),
  },
  {
    key: "estoque_atual",
    mobileCard: true,
    label: "Estoque",
    sortable: true,
    render: (p: Produto) => {
      const situacao = getSituacaoEstoque(p);
      const cfg = situacaoEstoqueConfig[situacao];
      return (
        <div className="space-y-0.5">
          <span className={`font-mono text-sm font-semibold ${cfg.textClass}`}>
            {p.estoque_atual ?? 0}
            <span className="text-[11px] text-muted-foreground ml-1 font-normal">{p.unidade_medida}</span>
          </span>
          {Number(p.estoque_minimo) > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono leading-none">
              mín: {p.estoque_minimo}
            </p>
          )}
          {situacao !== "normal" && (
            <StatusBadge
              status={cfg.statusBadge}
              label={cfg.label}
              className="text-[10px] px-1.5 h-4 mt-0.5"
            />
          )}
        </div>
      );
    },
  },
  {
    key: "preco_venda",
    mobileCard: true,
    label: "P. Venda",
    sortable: true,
    render: (p: Produto) => (
      <span className="font-semibold font-mono text-sm">{formatCurrency(p.preco_venda)}</span>
    ),
  },
  {
    key: "preco_custo",
    label: "P. Custo",
    sortable: true,
    render: (p: Produto) => (
      <span className="font-mono text-sm text-muted-foreground">{formatCurrency(p.preco_custo || 0)}</span>
    ),
  },
  {
    key: "margem",
    label: "Margem",
    render: (p: Produto) => {
      const custo = Number(p.preco_custo || 0);
      const venda = Number(p.preco_venda);
      const margem = custo > 0 ? (venda / custo - 1) * 100 : 0;
      return (
        <div className="flex flex-col">
          <span className={`font-mono text-xs ${margem > 0 ? "text-success" : margem < 0 ? "text-destructive" : ""}`}>
            {custo > 0 ? `${margem.toFixed(1)}%` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            +{formatCurrency(venda - custo)}
          </span>
        </div>
      );
    },
  },
  {
    key: "tipo_item",
    label: "Item",
    render: (p: Produto) => (
      <StatusBadge status={p.tipo_item || "produto"} />
    ),
  },
  {
    key: "ativo",
    mobileCard: true,
    label: "Status",
    render: (p: Produto) => (
      <StatusBadge status={p.ativo !== false ? "ativo" : "inativo"} />
    ),
  },
  {
    key: "eh_composto",
    label: "Tipo",
    hidden: true,
    render: (p: Produto) => (
      <StatusBadge status={p.eh_composto ? "composto" : "simples"} />
    ),
  },
];
