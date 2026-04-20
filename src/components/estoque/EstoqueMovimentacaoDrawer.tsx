import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { Badge } from "@/components/ui/badge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DrawerSummaryCard, DrawerSummaryGrid } from "@/components/ui/DrawerSummaryCard";
import { DrawerStatusBanner } from "@/components/ui/DrawerStatusBanner";
import { formatNumber } from "@/lib/format";
import { getOrigemConfig, getTipoMovConfig } from "@/components/estoque/estoqueMovimentacaoConfig";
import { AlertTriangle, User, FileText } from "lucide-react";

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
  usuario_id?: string | null;
  created_at: string;
  produtos?: { nome: string; sku: string };
}

interface EstoqueMovimentacaoDrawerProps {
  open: boolean;
  onClose: () => void;
  movimentacao: Movimento | null;
}

function origemLabel(tipo: string | null | undefined) {
  if (!tipo) return "—";
  return getOrigemConfig(tipo).label;
}

const origemRoutes: Record<string, string> = {
  pedido:        "/pedidos",
  nota_fiscal:   "/fiscal",
  fiscal:        "/fiscal",
};

// Tipos that should be navigated using RelationalLink with type+id (relational drawer)
const origemEntityType: Record<string, "pedido_compra" | "ordem_venda" | "nota_fiscal"> = {
  compra:        "pedido_compra",
  pedido_compra: "pedido_compra",
  pedido:        "ordem_venda",
  nota_fiscal:   "nota_fiscal",
  fiscal:        "nota_fiscal",
};

function OrigemBadge({ documentoTipo }: { documentoTipo: string | null | undefined }) {
  if (!documentoTipo) return null;
  const origem = getOrigemConfig(documentoTipo);
  return (
    <Badge variant="outline" className={`text-xs font-medium ${origem.className}`}>
      {origem.label}
    </Badge>
  );
}

function isAjusteManual(m: Movimento) {
  return m.tipo === "ajuste" || (m.documento_tipo === "manual" && m.tipo !== "entrada" && m.tipo !== "saida");
}

export function EstoqueMovimentacaoDrawer({
  open,
  onClose,
  movimentacao: m,
}: EstoqueMovimentacaoDrawerProps) {
  if (!m) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  const cfg = getTipoMovConfig(m.tipo);
  const TipoIcon = cfg.icon;

  const produtoNome = m.produtos?.nome ?? "—";
  const produtoSku  = m.produtos?.sku  ?? null;

  const dataCriacao = new Date(m.created_at);
  const dataFormatada = dataCriacao.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const sinal = m.tipo === "saida" || m.tipo === "perda_avaria" ? -1 : 1;
  const qtdFormatada = `${sinal < 0 ? "-" : "+"}${formatNumber(m.quantidade)}`;
  const delta = Number(m.saldo_atual) - Number(m.saldo_anterior);

  const temDocumento = Boolean(m.documento_id && m.documento_tipo && m.documento_tipo !== "manual");

  const movTone =
    cfg.direction === "out" ? "destructive" :
    cfg.direction === "in" ? "success" :
    "warning";

  /* ── Summary strip ── */
  const summary = (
    <DrawerSummaryGrid cols={4}>
      <DrawerSummaryCard
        label="Quantidade"
        value={qtdFormatada}
        hint="movimentada"
        tone={movTone}
        align="center"
      />
      <DrawerSummaryCard
        label="Saldo Após"
        value={formatNumber(m.saldo_atual)}
        hint={`antes: ${formatNumber(m.saldo_anterior)}`}
        align="center"
      />
      <DrawerSummaryCard
        label="Origem"
        value={origemLabel(m.documento_tipo)}
        hint={temDocumento ? "doc. vinculado" : "sem documento"}
        mono={false}
        align="center"
      />
      <DrawerSummaryCard
        label="Responsável"
        value={
          m.usuario_id ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs cursor-default">{m.usuario_id.slice(0, 8)}…</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-xs">{m.usuario_id}</TooltipContent>
            </Tooltip>
          ) : "—"
        }
        hint="usuário"
        mono={false}
        align="center"
      />
    </DrawerSummaryGrid>
  );

  /* ── Aba Resumo ── */
  const tabResumo = (
    <div className="space-y-4">
      <ViewSection title="Evento">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Produto">
            <span className="font-medium">{produtoNome}</span>
          </ViewField>
          {produtoSku && (
            <ViewField label="SKU">
              <span className="font-mono">{produtoSku}</span>
            </ViewField>
          )}
          <ViewField label="Tipo de Movimentação">
            <div className="flex items-center gap-1.5">
              <TipoIcon className="h-3.5 w-3.5 shrink-0" />
              <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
            </div>
          </ViewField>
          <ViewField label="Data / Hora">
            {dataFormatada}
          </ViewField>
          <ViewField label="Quantidade">
            <span className={`font-bold font-mono text-base ${cfg.direction === "out" ? "text-destructive" : cfg.direction === "in" ? "text-success" : "text-warning"}`}>
              {qtdFormatada}
            </span>
          </ViewField>
          <ViewField label="Origem">
            <OrigemBadge documentoTipo={m.documento_tipo} />
          </ViewField>
        </div>
      </ViewSection>

      {m.motivo && (
        <ViewSection title="Observação / Motivo">
          <p className="text-sm">{m.motivo}</p>
        </ViewSection>
      )}
    </div>
  );

  /* ── Aba Origem / Documento ── */
  const tabOrigem = (
    <div className="space-y-4">
      {!temDocumento ? (
        <div className="rounded-lg border bg-muted/40 p-4 flex gap-3 items-start">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Movimentação sem documento vinculado</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Esta movimentação foi registrada como{" "}
              <strong>{origemLabel(m.documento_tipo) || "manual"}</strong>, sem referência a
              um documento externo (compra, pedido ou nota fiscal).
            </p>
          </div>
        </div>
      ) : (
        <ViewSection title="Documento de Origem">
          <div className="grid grid-cols-2 gap-4">
            <ViewField label="Tipo de Documento">
              <OrigemBadge documentoTipo={m.documento_tipo} />
            </ViewField>
            <ViewField label="Referência / ID">
              <span className="font-mono text-xs">
                #{m.documento_id?.slice(0, 8)}…
              </span>
            </ViewField>
          </div>
        </ViewSection>
      )}

      {temDocumento && m.documento_tipo && (origemEntityType[m.documento_tipo] || origemRoutes[m.documento_tipo]) && (
        <ViewSection title="Navegação Relacional">
          <div className="flex items-center gap-2">
            {m.documento_id && origemEntityType[m.documento_tipo] ? (
              <RelationalLink
                type={origemEntityType[m.documento_tipo]}
                id={m.documento_id}
              >
                Abrir {origemLabel(m.documento_tipo)}
              </RelationalLink>
            ) : (
              <RelationalLink to={origemRoutes[m.documento_tipo]}>
                Abrir {origemLabel(m.documento_tipo)}
              </RelationalLink>
            )}
            {!origemEntityType[m.documento_tipo] && (
              <span className="text-xs text-muted-foreground">
                (ID: <span className="font-mono">{m.documento_id?.slice(0, 8)}…</span>)
              </span>
            )}
          </div>
        </ViewSection>
      )}
    </div>
  );

  /* ── Aba Rastreabilidade ── */
  const tabRastreabilidade = (
    <div className="space-y-4">
      {isAjusteManual(m) && (
        <DrawerStatusBanner
          tone="warning"
          icon={AlertTriangle}
          title="Ajuste Manual"
          description="Esta movimentação é um ajuste realizado manualmente. Verifique o responsável, a data e o motivo registrado abaixo."
        />
      )}

      <ViewSection title="Registro">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Data de Registro">
            {dataFormatada}
          </ViewField>
          <ViewField label="Responsável">
            {m.usuario_id ? (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 text-muted-foreground" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-xs cursor-default">{m.usuario_id.slice(0, 8)}…</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono text-xs">{m.usuario_id}</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </ViewField>
          <ViewField label="ID da Movimentação" className="col-span-2">
            <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
          </ViewField>
        </div>
      </ViewSection>

      <ViewSection title="Motivo / Justificativa">
        {m.motivo ? (
          <p className="text-sm">{m.motivo}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isAjusteManual(m)
              ? "Nenhum motivo registrado para este ajuste."
              : "Sem observação registrada."}
          </p>
        )}
      </ViewSection>
    </div>
  );

  /* ── Aba Impacto no Estoque ── */
  const tabImpacto = (
    <div className="space-y-4">
      <ViewSection title="Variação do Saldo">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
              Antes
            </p>
            <p className="text-xl font-bold font-mono">
              {formatNumber(m.saldo_anterior)}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-1">
            <TipoIcon className={`h-5 w-5 ${cfg.direction === "out" ? "text-destructive" : cfg.direction === "in" ? "text-success" : "text-warning"}`} />
            <p className={`text-base font-bold font-mono ${cfg.direction === "out" ? "text-destructive" : cfg.direction === "in" ? "text-success" : "text-warning"}`}>
              {qtdFormatada}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
              Depois
            </p>
            <p className="text-xl font-bold font-mono">
              {formatNumber(m.saldo_atual)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 px-4 py-2 text-center mt-2">
          <span className="text-xs text-muted-foreground">Variação líquida: </span>
          <span className={`text-sm font-bold font-mono ${delta >= 0 ? "text-success" : "text-destructive"}`}>
            {delta >= 0 ? "+" : ""}{formatNumber(delta)}
          </span>
        </div>
      </ViewSection>

      <ViewSection title="Contexto">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Tipo de Evento">
            <div className="flex items-center gap-1.5">
              <TipoIcon className={`h-3.5 w-3.5 shrink-0 ${cfg.direction === "out" ? "text-destructive" : cfg.direction === "in" ? "text-success" : "text-warning"}`} />
              <span className="text-sm">{cfg.label}</span>
            </div>
          </ViewField>
          <ViewField label="Origem">
            <OrigemBadge documentoTipo={m.documento_tipo} />
          </ViewField>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Este bloco reflete o impacto pontual desta movimentação. Para ver a posição
          atual do item, consulte a aba "Posição Atual".
        </p>
      </ViewSection>
    </div>
  );

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={produtoNome}
      subtitle={
        produtoSku
          ? `SKU: ${produtoSku} · ${dataFormatada}`
          : dataFormatada
      }
      badge={
        <div className="flex items-center gap-1.5">
          <TipoIcon className={`h-3.5 w-3.5 shrink-0 ${cfg.direction === "out" ? "text-destructive" : cfg.direction === "in" ? "text-success" : "text-warning"}`} />
          <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
          <OrigemBadge documentoTipo={m.documento_tipo} />
        </div>
      }
      summary={summary}
      tabs={[
        { value: "resumo",          label: "Resumo",          content: tabResumo },
        { value: "origem",          label: "Origem / Doc.",   content: tabOrigem },
        { value: "rastreabilidade", label: "Rastreabilidade", content: tabRastreabilidade },
        { value: "impacto",         label: "Impacto",         content: tabImpacto },
      ]}
      defaultTab="resumo"
    />
  );
}
