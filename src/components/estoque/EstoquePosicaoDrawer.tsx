import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  AlertTriangle,
  TrendingDown,
  CheckCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";

interface Movimento {
  id: string;
  produto_id: string;
  tipo: string;
  quantidade: number;
  saldo_anterior: number;
  saldo_atual: number;
  motivo: string;
  documento_tipo: string;
  documento_id: string;
  created_at: string;
  produtos?: { nome: string; sku: string };
}

interface ProdutoPosicao {
  id: string;
  nome: string;
  sku: string;
  codigo_interno: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  preco_venda: number;
  estoque_reservado?: number;
  estoque_ideal?: number;
  ponto_reposicao?: number;
  ativo?: boolean;
}

interface EstoquePosicaoDrawerProps {
  open: boolean;
  onClose: () => void;
  produto: ProdutoPosicao | null;
  movimentos: Movimento[];
  loadingMovimentos?: boolean;
}

type SituacaoEstoque = "normal" | "atencao" | "critico" | "zerado";

function getSituacao(produto: ProdutoPosicao): SituacaoEstoque {
  const atual = Number(produto.estoque_atual || 0);
  const minimo = Number(produto.estoque_minimo || 0);
  if (atual <= 0) return "zerado";
  if (minimo > 0 && atual <= minimo) return "critico";
  if (minimo > 0 && atual <= minimo * 1.2) return "atencao";
  return "normal";
}

const situacaoConfig: Record<
  SituacaoEstoque,
  { label: string; status: string; icon: typeof CheckCircle }
> = {
  normal:  { label: "Normal",           status: "ativo",     icon: CheckCircle  },
  atencao: { label: "Em Atenção",        status: "pendente",  icon: AlertTriangle },
  critico: { label: "Abaixo do Mínimo",  status: "cancelado", icon: TrendingDown  },
  zerado:  { label: "Sem Estoque",       status: "cancelado", icon: XCircle       },
};

function SituacaoBadge({ situacao }: { situacao: SituacaoEstoque }) {
  const cfg = situacaoConfig[situacao];
  const Icon = cfg.icon;
  const colorMap: Record<SituacaoEstoque, string> = {
    normal:  "bg-success/10 text-success border-success/20",
    atencao: "bg-warning/10 text-warning border-warning/20",
    critico: "bg-destructive/10 text-destructive border-destructive/20",
    zerado:  "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium gap-1 ${colorMap[situacao]}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function origemLabel(m: Movimento) {
  if (!m.documento_tipo) return "—";
  const labels: Record<string, string> = {
    manual: "Manual", fiscal: "Fiscal", compra: "Compra",
    venda: "Venda", ajuste: "Ajuste", estorno_fiscal: "Estorno",
    pedido: "Pedido", pedido_compra: "Compra", nota_fiscal: "Nota Fiscal",
  };
  return labels[m.documento_tipo] || m.documento_tipo;
}

function TipoMovIcon({ tipo }: { tipo: string }) {
  if (tipo === "entrada") return <ArrowUpCircle className="h-3.5 w-3.5 text-success shrink-0" />;
  if (tipo === "saida") return <ArrowDownCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  return <RotateCcw className="h-3.5 w-3.5 text-warning shrink-0" />;
}

export function EstoquePosicaoDrawer({
  open,
  onClose,
  produto,
  movimentos,
  loadingMovimentos,
}: EstoquePosicaoDrawerProps) {
  if (!produto) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  const situacao = getSituacao(produto);
  const atual = Number(produto.estoque_atual || 0);
  const minimo = Number(produto.estoque_minimo || 0);
  const reservado = Number(produto.estoque_reservado || 0);
  const disponivel = atual - reservado;
  const valorEstoque = atual * Number(produto.preco_venda || 0);

  const movsProduto = movimentos
    .filter((m) => m.produto_id === produto.id)
    .slice(0, 20);

  const ultimaMov = movsProduto[0] ?? null;

  const vinculos = movsProduto.filter(
    (m) => m.documento_tipo && m.documento_tipo !== "manual" && m.documento_id,
  );

  const precisaReposicao = situacao === "critico" || situacao === "zerado";

  const summary = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
          Saldo Atual
        </p>
        <p className="text-xl font-bold font-mono leading-tight">
          {formatNumber(atual)}
        </p>
        <p className="text-[10px] text-muted-foreground">{produto.unidade_medida || "UN"}</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
          Mínimo
        </p>
        <p className="text-xl font-bold font-mono leading-tight">
          {minimo > 0 ? formatNumber(minimo) : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground">{produto.unidade_medida || "UN"}</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
          Disponível
        </p>
        <p className="text-xl font-bold font-mono leading-tight">
          {formatNumber(disponivel)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {reservado > 0 ? `${formatNumber(reservado)} res.` : "sem reserva"}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
          Valor Est.
        </p>
        <p className="text-base font-bold font-mono leading-tight truncate">
          {produto.preco_venda ? formatCurrency(valorEstoque) : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground">R$ × qtd</p>
      </div>
    </div>
  );

  const tabResumo = (
    <div className="space-y-4">
      <ViewSection title="Identificação">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Produto">{produto.nome}</ViewField>
          <ViewField label="SKU / Código">
            <span className="font-mono">{produto.sku || produto.codigo_interno || "—"}</span>
          </ViewField>
          <ViewField label="Código Interno">
            <span className="font-mono">{produto.codigo_interno || "—"}</span>
          </ViewField>
          <ViewField label="Unidade">{produto.unidade_medida || "UN"}</ViewField>
        </div>
      </ViewSection>

      <ViewSection title="Posição do Estoque">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Estoque Atual">
            <span className="font-semibold font-mono">{formatNumber(atual)}</span>
          </ViewField>
          <ViewField label="Estoque Mínimo">
            <span className="font-mono">{minimo > 0 ? formatNumber(minimo) : "—"}</span>
          </ViewField>
          <ViewField label="Reservado">
            <span className="font-mono">{formatNumber(reservado)}</span>
          </ViewField>
          <ViewField label="Disponível">
            <span className="font-semibold font-mono">{formatNumber(disponivel)}</span>
          </ViewField>
          <ViewField label="Situação">
            <SituacaoBadge situacao={situacao} />
          </ViewField>
          {produto.preco_venda ? (
            <ViewField label="Valor em Estoque">
              <span className="font-semibold font-mono">{formatCurrency(valorEstoque)}</span>
            </ViewField>
          ) : null}
        </div>
      </ViewSection>

      {ultimaMov && (
        <ViewSection title="Última Movimentação">
          <div className="grid grid-cols-2 gap-4">
            <ViewField label="Data">
              {new Date(ultimaMov.created_at).toLocaleString("pt-BR", {
                day: "2-digit", month: "2-digit", year: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </ViewField>
            <ViewField label="Tipo">
              <StatusBadge
                status={
                  ultimaMov.tipo === "entrada" ? "confirmado"
                  : ultimaMov.tipo === "saida" ? "cancelado"
                  : "pendente"
                }
                label={
                  ultimaMov.tipo === "entrada" ? "Entrada"
                  : ultimaMov.tipo === "saida" ? "Saída"
                  : "Ajuste"
                }
              />
            </ViewField>
            <ViewField label="Quantidade">
              <span className="font-mono font-semibold">
                {ultimaMov.tipo === "saida" ? "-" : "+"}{formatNumber(ultimaMov.quantidade)}
              </span>
            </ViewField>
            <ViewField label="Origem">{origemLabel(ultimaMov)}</ViewField>
            {ultimaMov.motivo && (
              <ViewField label="Motivo" className="col-span-2">
                {ultimaMov.motivo}
              </ViewField>
            )}
          </div>
        </ViewSection>
      )}
    </div>
  );

  const tabMovimentacoes = (
    <div className="space-y-3">
      {loadingMovimentos ? (
        <p className="text-sm text-muted-foreground">Carregando movimentações...</p>
      ) : movsProduto.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <Package className="h-8 w-8 opacity-40" />
          <p className="text-sm">Nenhuma movimentação registrada</p>
        </div>
      ) : (
        movsProduto.map((m) => (
          <div
            key={m.id}
            className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5"
          >
            <TipoMovIcon tipo={m.tipo} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold capitalize">
                  {m.tipo === "entrada" ? "Entrada"
                    : m.tipo === "saida" ? "Saída"
                    : "Ajuste"}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {new Date(m.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`text-sm font-bold font-mono ${
                    m.tipo === "saida" ? "text-destructive" : "text-success"
                  }`}
                >
                  {m.tipo === "saida" ? "-" : "+"}{formatNumber(m.quantidade)}
                </span>
                <span className="text-xs text-muted-foreground">
                  saldo: <span className="font-mono font-medium">{formatNumber(m.saldo_atual)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{origemLabel(m)}</span>
              </div>
              {m.motivo && (
                <p className="text-[11px] text-muted-foreground truncate">{m.motivo}</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const tabVinculos = (
    <div className="space-y-4">
      {vinculos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <Package className="h-8 w-8 opacity-40" />
          <p className="text-sm">Nenhum vínculo encontrado nas movimentações recentes</p>
        </div>
      ) : (
        <ViewSection title="Documentos vinculados">
          <div className="space-y-2">
            {vinculos.slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TipoMovIcon tipo={m.tipo} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">
                      {origemLabel(m)}
                      {m.documento_id && (
                        <span className="ml-1 font-mono text-muted-foreground">
                          #{m.documento_id.slice(0, 8)}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("pt-BR")}
                      {" · "}
                      {m.tipo === "saida" ? "-" : "+"}{formatNumber(m.quantidade)}{" "}
                      {produto.unidade_medida || "UN"}
                    </p>
                  </div>
                </div>
                {m.documento_id && (
                  <RelationalLink
                    to={
                      m.documento_tipo === "compra" || m.documento_tipo === "pedido_compra"
                        ? "/compras"
                        : m.documento_tipo === "pedido"
                        ? "/pedidos"
                        : m.documento_tipo === "nota_fiscal" || m.documento_tipo === "fiscal"
                        ? "/fiscal"
                        : undefined
                    }
                  >
                    Ver origem
                  </RelationalLink>
                )}
              </div>
            ))}
          </div>
        </ViewSection>
      )}
    </div>
  );

  const tabReposicao = (
    <div className="space-y-4">
      {precisaReposicao ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive mb-1">
              {situacao === "zerado" ? "Sem Estoque" : "Abaixo do Estoque Mínimo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {situacao === "zerado"
                ? "Este item está com saldo zero. Considere acionar uma ordem de reposição."
                : `Saldo atual (${formatNumber(atual)}) está abaixo do mínimo definido (${formatNumber(minimo)}). Avalie a necessidade de reposição.`}
            </p>
          </div>
        </div>
      ) : situacao === "atencao" ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning mb-1">Em Atenção</p>
            <p className="text-xs text-muted-foreground">
              Saldo próximo ao mínimo ({formatNumber(atual)} / mín. {formatNumber(minimo)}).
              Monitore e antecipe a reposição se necessário.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-success/40 bg-success/5 p-4 flex gap-3">
          <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-success mb-1">Estoque Normal</p>
            <p className="text-xs text-muted-foreground">
              Saldo dentro dos parâmetros. Nenhuma ação imediata necessária.
            </p>
          </div>
        </div>
      )}

      <ViewSection title="Parâmetros de Reposição">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Estoque Mínimo">
            <span className="font-mono">{minimo > 0 ? formatNumber(minimo) : "Não definido"}</span>
          </ViewField>
          <ViewField label="Ponto de Reposição">
            <span className="font-mono">
              {produto.ponto_reposicao ? formatNumber(produto.ponto_reposicao) : "—"}
            </span>
          </ViewField>
          <ViewField label="Estoque Ideal">
            <span className="font-mono">
              {produto.estoque_ideal ? formatNumber(produto.estoque_ideal) : "—"}
            </span>
          </ViewField>
          <ViewField label="Necessidade de Reposição">
            {minimo > 0 && atual < minimo ? (
              <span className="font-semibold font-mono text-destructive">
                +{formatNumber(minimo - atual)}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </ViewField>
        </div>
      </ViewSection>
    </div>
  );

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={produto.nome}
      subtitle={
        produto.sku || produto.codigo_interno
          ? `${produto.sku ? `SKU: ${produto.sku}` : ""}${produto.sku && produto.codigo_interno ? " · " : ""}${produto.codigo_interno ? `Cód: ${produto.codigo_interno}` : ""}`
          : undefined
      }
      badge={<SituacaoBadge situacao={situacao} />}
      summary={summary}
      tabs={[
        { value: "resumo",       label: "Resumo",       content: tabResumo },
        { value: "movimentacoes", label: "Movimentações", content: tabMovimentacoes },
        { value: "vinculos",     label: "Vínculos",     content: tabVinculos },
        { value: "reposicao",    label: "Reposição",    content: tabReposicao },
      ]}
      defaultTab="resumo"
    />
  );
}
