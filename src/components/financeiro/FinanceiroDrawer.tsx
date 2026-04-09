import { useState, useEffect, useMemo } from "react";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, CreditCard, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Baixa {
  id: string;
  valor_pago: number;
  desconto: number;
  juros: number;
  multa: number;
  abatimento: number;
  data_baixa: string;
  forma_pagamento: string;
  observacoes: string | null;
  created_at: string;
}

interface Lancamento {
  id: string; tipo: string; descricao: string; valor: number;
  data_vencimento: string; data_pagamento: string; status: string;
  forma_pagamento: string; banco: string; cartao: string;
  cliente_id: string; fornecedor_id: string; nota_fiscal_id: string;
  conta_bancaria_id: string; conta_contabil_id: string;
  parcela_numero: number; parcela_total: number;
  documento_pai_id: string; saldo_restante: number | null;
  observacoes: string; ativo: boolean;
  created_at?: string;
  clientes?: { nome_razao_social: string };
  fornecedores?: { nome_razao_social: string };
  contas_bancarias?: { descricao: string; bancos?: { nome: string } };
  contas_contabeis?: { codigo: string; descricao: string };
}

interface FinanceiroDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: Lancamento | null;
  effectiveStatus: string;
  onBaixa: (l: Lancamento) => void;
  onEstorno: (l: Lancamento) => void;
  onEdit: (l: Lancamento) => void;
  onDelete: (id: string) => void;
}

export function FinanceiroDrawer({ open, onClose, selected, effectiveStatus, onBaixa, onEstorno, onEdit, onDelete }: FinanceiroDrawerProps) {
  const [baixas, setBaixas] = useState<Baixa[]>([]);
  const [loadingBaixas, setLoadingBaixas] = useState(false);

  useEffect(() => {
    if (!open || !selected) { setBaixas([]); return; }
    setLoadingBaixas(true);
    supabase
      .from("financeiro_baixas" as any)
      .select("*")
      .eq("lancamento_id", selected.id)
      .order("data_baixa", { ascending: false })
      .then(({ data }) => {
        setBaixas((data as Baixa[]) || []);
        setLoadingBaixas(false);
      });
  }, [open, selected?.id]);

  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  if (!selected) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  const canBaixa = effectiveStatus !== "pago" && effectiveStatus !== "cancelado";
  const canEstorno = effectiveStatus === "pago" || effectiveStatus === "parcial";

  const isCR = selected.tipo === "receber";
  const valorTotal = Number(selected.valor);
  const saldoRestante = selected.saldo_restante != null ? Number(selected.saldo_restante) : valorTotal;
  const valorBaixado = Math.max(0, valorTotal - saldoRestante);

  const vencimento = selected.data_vencimento
    ? new Date(selected.data_vencimento + "T00:00:00")
    : null;
  const diasAtraso =
    effectiveStatus === "vencido" && vencimento
      ? Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  const pessoa = isCR
    ? (selected.clientes?.nome_razao_social || "—")
    : (selected.fornecedores?.nome_razao_social || "—");

  const tipoLabel = isCR ? "Conta a Receber" : "Conta a Pagar";
  const tipoColor = isCR ? "text-success" : "text-destructive";

  const totalBaixado = baixas.reduce((sum, b) => sum + Number(b.valor_pago || 0), 0);

  const origemLabel = selected.nota_fiscal_id
    ? "Nota Fiscal"
    : selected.documento_pai_id
    ? "Parcelamento"
    : "Manual";

  const summary = (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Total</span>
        <p className="text-sm font-bold font-mono">{formatCurrency(valorTotal)}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isCR ? "Recebido" : "Pago"}</span>
        <p className="text-sm font-bold font-mono text-success">{formatCurrency(valorBaixado)}</p>
      </div>
      <div className={cn("rounded-lg border p-3 space-y-0.5", saldoRestante > 0 ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20")}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo em Aberto</span>
        <p className={cn("text-sm font-bold font-mono", saldoRestante > 0 ? "text-destructive" : "text-success")}>
          {formatCurrency(saldoRestante)}
        </p>
      </div>
      <div className={cn("rounded-lg border p-3 space-y-0.5", effectiveStatus === "vencido" ? "bg-destructive/5 border-destructive/20" : "bg-muted/30")}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vencimento</span>
        <p className={cn("text-sm font-semibold", effectiveStatus === "vencido" ? "text-destructive" : "")}>
          {vencimento ? vencimento.toLocaleDateString("pt-BR") : "—"}
        </p>
        {diasAtraso > 0 && (
          <p className="text-[10px] text-destructive font-medium">{diasAtraso} dia(s) em atraso</p>
        )}
      </div>
    </div>
  );

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={tipoLabel}
      subtitle={
        <span>
          <span className={cn("font-medium", tipoColor)}>{pessoa}</span>
          {selected.descricao ? ` · ${selected.descricao}` : ""}
        </span>
      }
      badge={<StatusBadge status={effectiveStatus} />}
      summary={summary}
      actions={
        <>
          {canBaixa && (
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => onBaixa(selected)}><CreditCard className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Registrar Baixa</TooltipContent></Tooltip>
          )}
          {canEstorno && (
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-warning hover:text-warning" onClick={() => { onClose(); onEstorno(selected); }}><RotateCcw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Estornar Baixa</TooltipContent></Tooltip>
          )}
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { onClose(); onEdit(selected); }}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { onClose(); onDelete(selected.id); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir</TooltipContent></Tooltip>
        </>
      }
      tabs={[
        { value: "resumo", label: "Resumo", content: (
          <div className="space-y-4">
            <ViewSection title="Identificação">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Tipo">
                  <Badge variant="outline" className={isCR ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}>
                    {isCR ? "A Receber" : "A Pagar"}
                  </Badge>
                </ViewField>
                <ViewField label="Status"><StatusBadge status={effectiveStatus} /></ViewField>
              </div>
              <ViewField label="Descrição">{selected.descricao || "—"}</ViewField>
              <ViewField label={isCR ? "Cliente" : "Fornecedor"}>
                {isCR && selected.cliente_id ? (
                  <RelationalLink type="cliente" id={selected.cliente_id}>{pessoa}</RelationalLink>
                ) : !isCR && selected.fornecedor_id ? (
                  <RelationalLink type="fornecedor" id={selected.fornecedor_id}>{pessoa}</RelationalLink>
                ) : pessoa}
              </ViewField>
            </ViewSection>
            <ViewSection title="Pagamento">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Forma de Pagamento">{selected.forma_pagamento || "—"}</ViewField>
                {selected.parcela_numero ? (
                  <ViewField label="Parcela"><span className="font-mono">{selected.parcela_numero}/{selected.parcela_total}</span></ViewField>
                ) : null}
              </div>
              {selected.data_pagamento && (
                <ViewField label="Data do Pagamento">{new Date(selected.data_pagamento).toLocaleDateString("pt-BR")}</ViewField>
              )}
            </ViewSection>
            {selected.observacoes && (
              <ViewSection title="Observações">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.observacoes}</p>
              </ViewSection>
            )}
          </div>
        )},
        { value: "baixas", label: baixas.length > 0 ? `Baixas (${baixas.length})` : "Baixas", content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total {isCR ? "Recebido" : "Pago"}</span>
                <p className="text-sm font-bold font-mono text-success">{formatCurrency(valorBaixado)}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo em Aberto</span>
                <p className={cn("text-sm font-bold font-mono", saldoRestante > 0 ? "text-destructive" : "text-success")}>{formatCurrency(saldoRestante)}</p>
              </div>
            </div>
            {loadingBaixas ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando baixas...</p>
            ) : baixas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhuma baixa registrada</p>
                {canBaixa && (
                  <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => onBaixa(selected)}>
                    <CreditCard className="h-3.5 w-3.5" /> Registrar Baixa
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Histórico de Baixas</span>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Forma</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baixas.map((b, i) => (
                        <tr key={b.id} className={cn("border-b last:border-0", i % 2 !== 0 && "bg-muted/20")}>
                          <td className="px-3 py-2">{new Date(b.data_baixa).toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-success">{formatCurrency(Number(b.valor_pago))}</td>
                          <td className="px-3 py-2">{b.forma_pagamento || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{b.observacoes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {baixas.length > 1 && (
                  <p className="text-xs text-muted-foreground text-right">
                    {baixas.length} baixas · total {isCR ? "recebido" : "pago"}: <span className="font-mono font-semibold text-success">{formatCurrency(totalBaixado)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )},
        { value: "origem", label: "Origem", content: (
          <div className="space-y-4">
            <ViewSection title="Origem do Lançamento">
              <ViewField label="Tipo de Origem">{origemLabel}</ViewField>
              {selected.nota_fiscal_id && (
                <ViewField label="Nota Fiscal Vinculada">
                  <RelationalLink type="nota_fiscal" id={selected.nota_fiscal_id}>Ver NF vinculada</RelationalLink>
                </ViewField>
              )}
              {selected.documento_pai_id && (
                <ViewField label="Grupo de Parcelas">
                  <span className="font-mono text-muted-foreground text-xs">{selected.documento_pai_id}</span>
                </ViewField>
              )}
              {selected.parcela_numero ? (
                <ViewField label="Parcela">
                  <span className="font-mono">{selected.parcela_numero} de {selected.parcela_total}</span>
                </ViewField>
              ) : null}
            </ViewSection>
            <ViewSection title="Conta / Banco">
              {selected.contas_bancarias ? (
                <ViewField label="Conta Bancária">
                  <RelationalLink to="/contas-bancarias">
                    {selected.contas_bancarias.bancos?.nome} - {selected.contas_bancarias.descricao}
                  </RelationalLink>
                </ViewField>
              ) : (
                <ViewField label="Conta Bancária">—</ViewField>
              )}
              {selected.contas_contabeis && (
                <ViewField label="Conta Contábil">
                  <RelationalLink to="/contas-contabeis">{selected.contas_contabeis.codigo} - {selected.contas_contabeis.descricao}</RelationalLink>
                </ViewField>
              )}
            </ViewSection>
          </div>
        )},
        { value: "historico", label: "Histórico", content: (
          <div className="space-y-4">
            <ViewSection title="Rastreabilidade">
              <div className="grid grid-cols-2 gap-4">
                {selected.created_at && (
                  <ViewField label="Cadastrado em">
                    {new Date(selected.created_at).toLocaleDateString("pt-BR")}
                  </ViewField>
                )}
                {selected.data_pagamento && (
                  <ViewField label="Liquidado em">
                    {new Date(selected.data_pagamento).toLocaleDateString("pt-BR")}
                  </ViewField>
                )}
                <ViewField label="Status Atual"><StatusBadge status={effectiveStatus} /></ViewField>
                <ViewField label="Ativo">
                  <Badge variant="outline">{selected.ativo !== false ? "Sim" : "Não"}</Badge>
                </ViewField>
              </div>
            </ViewSection>
            {selected.observacoes && (
              <ViewSection title="Observações Internas">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.observacoes}</p>
              </ViewSection>
            )}
          </div>
        )},
      ]}
    />
  );
}
