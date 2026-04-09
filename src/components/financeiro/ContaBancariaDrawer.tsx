import { useState, useEffect } from "react";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RelationalLink } from "@/components/ui/RelationalLink";
import {
  Edit,
  Trash2,
  Landmark,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ContaBancaria {
  id: string;
  banco_id: string;
  descricao: string;
  agencia: string | null;
  conta: string | null;
  titular: string | null;
  saldo_atual: number | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  bancos?: { nome: string; tipo: string };
}

interface LancamentoResumo {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  forma_pagamento: string | null;
  clientes?: { nome_razao_social: string } | null;
  fornecedores?: { nome_razao_social: string } | null;
}

interface BaixaResumo {
  id: string;
  valor_pago: number;
  data_baixa: string;
  forma_pagamento: string | null;
  lancamento_id: string;
}

interface CaixaMovimento {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  created_at: string;
}

interface ContaBancariaDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: ContaBancaria | null;
  onEdit: (c: ContaBancaria) => void;
  onDelete: (c: ContaBancaria) => void;
}

const tipoContaLabel: Record<string, string> = {
  corrente: "Conta Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  caixa: "Caixa",
};

function getTipoLabel(tipo: string | undefined) {
  if (!tipo) return "—";
  return tipoContaLabel[tipo.toLowerCase()] ?? tipo;
}

export function ContaBancariaDrawer({
  open,
  onClose,
  selected,
  onEdit,
  onDelete,
}: ContaBancariaDrawerProps) {
  const [lancamentos, setLancamentos] = useState<LancamentoResumo[]>([]);
  const [baixas, setBaixas] = useState<BaixaResumo[]>([]);
  const [caixaMovs, setCaixaMovs] = useState<CaixaMovimento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !selected) {
      setLancamentos([]);
      setBaixas([]);
      setCaixaMovs([]);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase
        .from("financeiro_lancamentos")
        .select(
          "id, tipo, descricao, valor, data_vencimento, status, forma_pagamento, clientes(nome_razao_social), fornecedores(nome_razao_social)"
        )
        .eq("conta_bancaria_id", selected.id)
        .eq("ativo", true)
        .order("data_vencimento", { ascending: false })
        .limit(10),
      supabase
        .from("financeiro_baixas" as any)
        .select("id, valor_pago, data_baixa, forma_pagamento, lancamento_id")
        .eq("conta_bancaria_id", selected.id)
        .order("data_baixa", { ascending: false })
        .limit(10),
      supabase
        .from("caixa_movimentos")
        .select("id, tipo, descricao, valor, created_at")
        .eq("conta_bancaria_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(([lanc, bx, cx]) => {
      setLancamentos((lanc.data as LancamentoResumo[]) || []);
      setBaixas((bx.data as BaixaResumo[]) || []);
      setCaixaMovs((cx.data as CaixaMovimento[]) || []);
      setLoading(false);
    });
  }, [open, selected?.id]);

  if (!selected) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  const saldo = Number(selected.saldo_atual ?? 0);
  const totalReceber = lancamentos
    .filter((l) => l.tipo === "receber" && l.status !== "pago" && l.status !== "cancelado")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalPagar = lancamentos
    .filter((l) => l.tipo === "pagar" && l.status !== "pago" && l.status !== "cancelado")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalBaixas = baixas.reduce((s, b) => s + Number(b.valor_pago), 0);

  const ultimaBaixa = baixas[0]
    ? new Date(baixas[0].data_baixa).toLocaleDateString("pt-BR")
    : null;

  const formasPagamento = Array.from(
    new Set(
      baixas
        .map((b) => b.forma_pagamento)
        .filter(Boolean) as string[]
    )
  );

  const bancoLabel = selected.bancos?.nome ?? "—";
  const tipoLabel = getTipoLabel(selected.bancos?.tipo);

  const summary = (
    <div className="grid grid-cols-2 gap-2">
      <div
        className={cn(
          "rounded-lg border p-3 space-y-0.5",
          saldo >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Saldo Atual
        </span>
        <p
          className={cn(
            "text-sm font-bold font-mono",
            saldo >= 0 ? "text-success" : "text-destructive"
          )}
        >
          {formatCurrency(saldo)}
        </p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Lançamentos
        </span>
        <p className="text-sm font-bold font-mono">{lancamentos.length}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Total Baixado
        </span>
        <p className="text-sm font-bold font-mono text-success">{formatCurrency(totalBaixas)}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Última Baixa
        </span>
        <p className="text-sm font-semibold">{ultimaBaixa ?? "—"}</p>
      </div>
    </div>
  );

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={selected.descricao}
      subtitle={
        <span>
          <Landmark className="inline h-3 w-3 mr-1 text-muted-foreground" />
          {bancoLabel}
          {tipoLabel !== "—" ? ` · ${tipoLabel}` : ""}
        </span>
      }
      badge={
        <Badge
          variant="outline"
          className={
            selected.ativo
              ? "border-success/40 text-success"
              : "border-muted-foreground/40 text-muted-foreground"
          }
        >
          {selected.ativo ? "Ativa" : "Inativa"}
        </Badge>
      }
      summary={summary}
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { onClose(); onEdit(selected); }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => { onClose(); onDelete(selected); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </>
      }
      tabs={[
        {
          value: "resumo",
          label: "Resumo",
          content: (
            <div className="space-y-4">
              <ViewSection title="Dados da Conta">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Banco">{bancoLabel}</ViewField>
                  <ViewField label="Tipo">{tipoLabel}</ViewField>
                  {selected.agencia && (
                    <ViewField label="Agência">
                      <span className="font-mono">{selected.agencia}</span>
                    </ViewField>
                  )}
                  {selected.conta && (
                    <ViewField label="Conta">
                      <span className="font-mono">{selected.conta}</span>
                    </ViewField>
                  )}
                  {selected.titular && (
                    <ViewField label="Titular">{selected.titular}</ViewField>
                  )}
                  <ViewField label="Status">
                    <Badge
                      variant="outline"
                      className={
                        selected.ativo
                          ? "border-success/40 text-success"
                          : "border-muted-foreground/40 text-muted-foreground"
                      }
                    >
                      {selected.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </ViewField>
                </div>
              </ViewSection>
              <ViewSection title="Posição Financeira">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Saldo Atual">
                    <span
                      className={cn(
                        "font-mono font-bold",
                        saldo >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {formatCurrency(saldo)}
                    </span>
                  </ViewField>
                  <ViewField label="Lançamentos Ativos">
                    <span className="font-mono">{lancamentos.length}</span>
                  </ViewField>
                  <ViewField label="A Receber (aberto)">
                    <span className="font-mono text-success">{formatCurrency(totalReceber)}</span>
                  </ViewField>
                  <ViewField label="A Pagar (aberto)">
                    <span className="font-mono text-destructive">{formatCurrency(totalPagar)}</span>
                  </ViewField>
                </div>
              </ViewSection>
            </div>
          ),
        },
        {
          value: "movimentacoes",
          label: lancamentos.length > 0 ? `Movimentações (${lancamentos.length})` : "Movimentações",
          content: (
            <div className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
              ) : lancamentos.length === 0 && baixas.length === 0 && caixaMovs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma movimentação registrada</p>
                  <p className="text-xs mt-1">
                    Esta conta ainda não está vinculada a lançamentos ou baixas.
                  </p>
                </div>
              ) : (
                <>
                  {lancamentos.length > 0 && (
                    <ViewSection title="Últimos Lançamentos">
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                                Descrição
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                                Venc.
                              </th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                                Valor
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lancamentos.map((l, i) => (
                              <tr
                                key={l.id}
                                className={cn(
                                  "border-b last:border-0",
                                  i % 2 !== 0 && "bg-muted/20"
                                )}
                              >
                                <td className="px-3 py-2 max-w-[120px] truncate">
                                  {l.descricao || "—"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {new Date(
                                    l.data_vencimento + "T00:00:00"
                                  ).toLocaleDateString("pt-BR")}
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-mono font-semibold whitespace-nowrap",
                                    l.tipo === "receber"
                                      ? "text-success"
                                      : "text-destructive"
                                  )}
                                >
                                  {l.tipo === "receber" ? "+" : "-"}
                                  {formatCurrency(Number(l.valor))}
                                </td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={l.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>{lancamentos.length} lançamento(s) exibido(s)</span>
                        <RelationalLink to="/financeiro">Ver todos no Financeiro</RelationalLink>
                      </div>
                    </ViewSection>
                  )}

                  {baixas.length > 0 && (
                    <ViewSection title="Últimas Baixas">
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                                Data
                              </th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                                Valor
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
                                Forma
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {baixas.map((b, i) => (
                              <tr
                                key={b.id}
                                className={cn(
                                  "border-b last:border-0",
                                  i % 2 !== 0 && "bg-muted/20"
                                )}
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {new Date(b.data_baixa).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-success whitespace-nowrap">
                                  {formatCurrency(Number(b.valor_pago))}
                                </td>
                                <td className="px-3 py-2">{b.forma_pagamento || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ViewSection>
                  )}

                  {caixaMovs.length > 0 && (
                    <ViewSection title="Caixa / Movimentos">
                      <div className="space-y-1.5">
                        {caixaMovs.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {m.tipo === "entrada" ? (
                                <TrendingUp className="h-3 w-3 text-success shrink-0" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
                              )}
                              <span className="truncate">{m.descricao}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span
                                className={cn(
                                  "font-mono font-semibold",
                                  m.tipo === "entrada"
                                    ? "text-success"
                                    : "text-destructive"
                                )}
                              >
                                {m.tipo === "entrada" ? "+" : "-"}
                                {formatCurrency(Number(m.valor))}
                              </span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {new Date(m.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ViewSection>
                  )}
                </>
              )}
            </div>
          ),
        },
        {
          value: "configuracao",
          label: "Configuração",
          content: (
            <div className="space-y-4">
              <ViewSection title="Dados Bancários">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Banco">{bancoLabel}</ViewField>
                  <ViewField label="Tipo de Conta">{tipoLabel}</ViewField>
                  <ViewField label="Agência">
                    <span className="font-mono">{selected.agencia || "—"}</span>
                  </ViewField>
                  <ViewField label="Número da Conta">
                    <span className="font-mono">{selected.conta || "—"}</span>
                  </ViewField>
                  <ViewField label="Titular">{selected.titular || "—"}</ViewField>
                  <ViewField label="Saldo Inicial / Atual">
                    <span className={cn("font-mono font-semibold", saldo >= 0 ? "text-success" : "text-destructive")}>
                      {formatCurrency(saldo)}
                    </span>
                  </ViewField>
                </div>
              </ViewSection>
              <ViewSection title="Controle">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Status">
                    <Badge
                      variant="outline"
                      className={
                        selected.ativo
                          ? "border-success/40 text-success"
                          : "border-muted-foreground/40 text-muted-foreground"
                      }
                    >
                      {selected.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </ViewField>
                  {selected.created_at && (
                    <ViewField label="Cadastrada em">
                      {new Date(selected.created_at).toLocaleDateString("pt-BR")}
                    </ViewField>
                  )}
                  {selected.updated_at && (
                    <ViewField label="Última atualização">
                      {new Date(selected.updated_at).toLocaleDateString("pt-BR")}
                    </ViewField>
                  )}
                </div>
              </ViewSection>
            </div>
          ),
        },
        {
          value: "vinculos",
          label: "Vínculos",
          content: (
            <div className="space-y-4">
              <ViewSection title="Uso no Financeiro">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Lançamentos Vinculados">
                    <span className="font-mono font-semibold">{lancamentos.length}</span>
                    {lancamentos.length > 0 && (
                      <span className="ml-1 text-muted-foreground">(exibindo até 10)</span>
                    )}
                  </ViewField>
                  <ViewField label="Baixas Registradas">
                    <span className="font-mono font-semibold">{baixas.length}</span>
                  </ViewField>
                  <ViewField label="Total Baixado">
                    <span className="font-mono font-semibold text-success">
                      {formatCurrency(totalBaixas)}
                    </span>
                  </ViewField>
                  <ViewField label="Movimentos de Caixa">
                    <span className="font-mono font-semibold">{caixaMovs.length}</span>
                  </ViewField>
                </div>
              </ViewSection>

              {formasPagamento.length > 0 && (
                <ViewSection title="Formas de Pagamento Utilizadas">
                  <div className="flex flex-wrap gap-2">
                    {formasPagamento.map((fp) => (
                      <Badge key={fp} variant="secondary">
                        {fp}
                      </Badge>
                    ))}
                  </div>
                </ViewSection>
              )}

              <ViewSection title="Navegação Rápida">
                <div className="space-y-2">
                  <RelationalLink to="/financeiro">
                    Ver lançamentos desta conta no Financeiro
                  </RelationalLink>
                  <RelationalLink to="/caixa">
                    Ver movimentos no Caixa
                  </RelationalLink>
                </div>
              </ViewSection>

              <ViewSection title="Evolução Futura">
                <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold">Conciliação bancária</p>
                  <p>
                    Esta conta está preparada para futura importação de extrato (OFX/CSV) e
                    conciliação automática ou manual entre extrato e lançamentos ERP.
                  </p>
                </div>
              </ViewSection>
            </div>
          ),
        },
      ]}
    />
  );
}

