import { useState, useEffect } from "react";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Edit, Trash2, CheckCircle, XCircle, ArrowLeftRight, FileText,
  Package, DollarSign, AlertCircle, Copy,
} from "lucide-react";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const modeloLabels: Record<string, string> = {
  "55": "NF-e", "65": "NFC-e", "57": "CT-e", "67": "CT-e OS", nfse: "NFS-e", outro: "Outro",
};

interface StatusInfo { description: string; colorClass: string }
const statusInfoMap: Record<string, StatusInfo> = {
  pendente: {
    description: "Nota em rascunho — pendente de confirmação. Estoque e financeiro ainda não foram impactados.",
    colorClass: "bg-warning/5 border-warning/20 text-warning",
  },
  confirmada: {
    description: "Nota fiscal confirmada. Estoque e lançamentos financeiros já foram registrados.",
    colorClass: "bg-success/5 border-success/20 text-success",
  },
  cancelada: {
    description: "Nota fiscal cancelada — sem vigência fiscal ou operacional.",
    colorClass: "bg-destructive/5 border-destructive/20 text-destructive",
  },
  importada: {
    description: "Nota importada a partir de XML externo.",
    colorClass: "bg-primary/5 border-primary/20 text-primary",
  },
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotaFiscal {
  id: string; tipo: string; numero: string; serie: string; chave_acesso: string;
  data_emissao: string; fornecedor_id: string; cliente_id: string;
  valor_total: number; status: string; forma_pagamento: string; condicao_pagamento: string;
  observacoes: string; ativo: boolean; movimenta_estoque: boolean; gera_financeiro: boolean;
  ordem_venda_id: string | null; conta_contabil_id: string | null;
  modelo_documento: string; nf_referenciada_id: string | null; tipo_operacao: string;
  frete_valor: number; icms_valor: number; ipi_valor: number; pis_valor: number;
  cofins_valor: number; icms_st_valor: number; desconto_valor: number; outras_despesas: number;
  fornecedores?: { nome_razao_social: string; cpf_cnpj: string };
  clientes?: { nome_razao_social: string };
  ordens_venda?: { numero: string };
}

interface NotaFiscalDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: NotaFiscal | null;
  onEdit: (nf: NotaFiscal) => void;
  onDelete: (id: string) => void;
  onConfirmar: (nf: NotaFiscal) => void;
  onEstornar: (nf: NotaFiscal) => void;
  onDevolucao: (nf: NotaFiscal) => void;
  onDanfe: (nf: NotaFiscal) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotaFiscalDrawer({
  open, onClose, selected,
  onEdit, onDelete, onConfirmar, onEstornar, onDevolucao, onDanfe,
}: NotaFiscalDrawerProps) {
  const [items, setItems] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (!open || !selected) {
      setItems([]);
      setLancamentos([]);
      setMovimentos([]);
      return;
    }
    setLoadingExtra(true);
    Promise.all([
      supabase
        .from("notas_fiscais_itens")
        .select("*, produtos(id, nome, sku), contas_contabeis(codigo, descricao)")
        .eq("nota_fiscal_id", selected.id),
      supabase
        .from("financeiro_lancamentos")
        .select("id, tipo, descricao, valor, data_vencimento, status, forma_pagamento, parcela_numero, parcela_total")
        .or(`nota_fiscal_id.eq.${selected.id},documento_fiscal_id.eq.${selected.id}`)
        .order("parcela_numero", { ascending: true }),
      supabase
        .from("estoque_movimentos")
        .select("*, produtos(id, nome, sku)")
        .eq("documento_id", selected.id)
        .eq("documento_tipo", "fiscal")
        .order("created_at" as any, { ascending: true }),
    ]).then(([{ data: it }, { data: lanc }, { data: mov }]) => {
      setItems(it || []);
      setLancamentos((lanc as any[]) || []);
      setMovimentos((mov as any[]) || []);
      setLoadingExtra(false);
    });
  }, [open, selected]);

  if (!selected) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  // ── Derived values ───────────────────────────────────────────────────────────

  const parceiro =
    selected.tipo === "entrada"
      ? selected.fornecedores?.nome_razao_social || "—"
      : selected.clientes?.nome_razao_social || "—";

  const parceiroId =
    selected.tipo === "entrada" ? selected.fornecedor_id : selected.cliente_id;
  const parceiroType =
    selected.tipo === "entrada" ? "fornecedor" : "cliente";

  const totalProdutos = items.reduce(
    (s, i) => s + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0,
  );
  const totalImpostos =
    Number(selected.icms_valor || 0) +
    Number(selected.ipi_valor || 0) +
    Number(selected.pis_valor || 0) +
    Number(selected.cofins_valor || 0) +
    Number(selected.icms_st_valor || 0);

  const modelo = modeloLabels[selected.modelo_documento || "55"] || selected.modelo_documento;
  const temChaveAcesso = !!selected.chave_acesso;
  const condicaoLabel =
    selected.condicao_pagamento === "a_vista" ? "À Vista" :
    selected.condicao_pagamento === "a_prazo" ? "A Prazo" :
    selected.condicao_pagamento || "—";

  const statusInfo = statusInfoMap[selected.status] ?? null;

  const canConfirmar = selected.status === "pendente";
  const canEstornar = selected.status === "confirmada";
  const canDevolucao =
    selected.status === "confirmada" &&
    selected.tipo === "saida" &&
    (selected.tipo_operacao || "normal") === "normal";

  const copyChave = () => {
    navigator.clipboard.writeText(selected.chave_acesso);
    toast.success("Chave de acesso copiada!");
  };

  // ── Summary strip ─────────────────────────────────────────────────────────────

  const summary = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Modelo
        </span>
        <p className="text-sm font-bold font-mono">{modelo}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Produtos
        </span>
        <p className="text-sm font-bold font-mono">{formatCurrency(totalProdutos)}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Impostos
        </span>
        <p className="text-sm font-bold font-mono">{formatCurrency(totalImpostos)}</p>
      </div>
      <div className="rounded-lg border bg-accent/40 p-3 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Total NF
        </span>
        <p className="text-sm font-bold font-mono text-primary">
          {formatCurrency(Number(selected.valor_total))}
        </p>
      </div>
    </div>
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  const tabResumo = (
    <div className="space-y-5">
      {statusInfo && (
        <div className={cn("rounded-lg border p-3 flex items-start gap-2", statusInfo.colorClass)}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-xs">{statusInfo.description}</p>
        </div>
      )}

      <ViewSection title="Identificação">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Tipo">
            <Badge
              variant="outline"
              className={
                selected.tipo === "entrada"
                  ? "border-primary/40 text-primary"
                  : "border-warning/40 text-warning"
              }
            >
              {selected.tipo === "entrada" ? "Entrada" : "Saída"}
            </Badge>
          </ViewField>
          <ViewField label="Modelo">
            <span className="font-mono font-medium">{modelo}</span>
          </ViewField>
          <ViewField label="Número / Série">
            <span className="font-mono font-medium">
              {selected.numero} / {selected.serie || "1"}
            </span>
          </ViewField>
          <ViewField label="Data de Emissão">{formatDate(selected.data_emissao)}</ViewField>
          <ViewField label="Status"><StatusBadge status={selected.status} /></ViewField>
          {(selected.tipo_operacao || "normal") !== "normal" && (
            <ViewField label="Operação">
              <span className="font-medium capitalize text-warning">{selected.tipo_operacao}</span>
            </ViewField>
          )}
        </div>
      </ViewSection>

      <ViewSection title="Parceiro">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label={selected.tipo === "entrada" ? "Fornecedor" : "Cliente"}>
            {parceiroId ? (
              <RelationalLink type={parceiroType as "fornecedor" | "cliente"} id={parceiroId}>
                {parceiro}
              </RelationalLink>
            ) : (
              parceiro
            )}
          </ViewField>
          {selected.ordem_venda_id && selected.ordens_venda && (
            <ViewField label="Pedido Vinculado">
              <RelationalLink type="ordem_venda" id={selected.ordem_venda_id}>
                <span className="font-mono">{selected.ordens_venda.numero}</span>
              </RelationalLink>
            </ViewField>
          )}
        </div>
      </ViewSection>

      <ViewSection title="Pagamento">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Condição">{condicaoLabel}</ViewField>
          <ViewField label="Forma">
            <span className="capitalize">{selected.forma_pagamento || "—"}</span>
          </ViewField>
          <ViewField label="Gera Financeiro">
            <span className={selected.gera_financeiro !== false ? "text-success font-medium" : "text-muted-foreground"}>
              {selected.gera_financeiro !== false ? "Sim" : "Não"}
            </span>
          </ViewField>
          <ViewField label="Mov. Estoque">
            <span className={selected.movimenta_estoque !== false ? "text-success font-medium" : "text-muted-foreground"}>
              {selected.movimenta_estoque !== false ? "Sim" : "Não"}
            </span>
          </ViewField>
        </div>
      </ViewSection>

      {selected.observacoes && (
        <ViewSection title="Observações">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.observacoes}</p>
        </ViewSection>
      )}
    </div>
  );

  const tabItens = (
    <div className="space-y-4">
      {items.length > 0 ? (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Unit.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">CST</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">CFOP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      {i.produtos?.id ? (
                        <RelationalLink type="produto" id={i.produtos.id}>
                          <span className="truncate max-w-[120px] block">{i.produtos?.nome || "—"}</span>
                        </RelationalLink>
                      ) : (
                        i.produtos?.nome || "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{i.quantidade}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {formatCurrency(i.valor_unitario)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                      {formatCurrency(Number(i.quantidade) * Number(i.valor_unitario))}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{i.cst || "—"}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{i.cfop || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg bg-muted/30 border p-3 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              {items.length} item(ns) · Subtotal Produtos
            </span>
            <span className="font-mono font-bold">{formatCurrency(totalProdutos)}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum item registrado</p>
      )}
    </div>
  );

  const tabFiscal = (
    <div className="space-y-5">
      <ViewSection title="Identificação Fiscal">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Modelo / Tipo">{modelo}</ViewField>
          <ViewField label="Número">
            <span className="font-mono font-medium">{selected.numero}</span>
          </ViewField>
          <ViewField label="Série">
            <span className="font-mono">{selected.serie || "1"}</span>
          </ViewField>
          <ViewField label="Data de Emissão">{formatDate(selected.data_emissao)}</ViewField>
          <ViewField label="Status Fiscal">
            <StatusBadge status={selected.status} />
          </ViewField>
          <ViewField label="Operação">
            <span className="capitalize">{selected.tipo === "entrada" ? "Entrada" : "Saída"}</span>
          </ViewField>
        </div>

        <div className="mt-3 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Chave de Acesso
          </span>
          {temChaveAcesso ? (
            <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
              <p className="font-mono text-xs break-all flex-1 leading-relaxed select-all">
                {selected.chave_acesso}
              </p>
              <button
                type="button"
                onClick={copyChave}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                title="Copiar chave de acesso"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-1">Chave de acesso não informada</p>
          )}
        </div>
      </ViewSection>

      <ViewSection title="Tributos">
        <div className="rounded-lg bg-accent/30 border p-4 space-y-2">
          {[
            { label: "Subtotal Produtos", val: totalProdutos },
            { label: "Frete", val: Number(selected.frete_valor || 0) },
            { label: "ICMS", val: Number(selected.icms_valor || 0) },
            { label: "IPI", val: Number(selected.ipi_valor || 0) },
            { label: "PIS", val: Number(selected.pis_valor || 0) },
            { label: "COFINS", val: Number(selected.cofins_valor || 0) },
            { label: "ICMS-ST", val: Number(selected.icms_st_valor || 0) },
            { label: "Outras Despesas", val: Number(selected.outras_despesas || 0) },
          ].map(({ label, val }) =>
            val > 0 ? (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{formatCurrency(val)}</span>
              </div>
            ) : null,
          )}
          {Number(selected.desconto_valor || 0) > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Desconto</span>
              <span className="font-mono">−{formatCurrency(Number(selected.desconto_valor))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-2 mt-1">
            <span>Total da NF</span>
            <span className="font-mono text-base text-primary">
              {formatCurrency(Number(selected.valor_total))}
            </span>
          </div>
        </div>
      </ViewSection>
    </div>
  );

  const tabArquivos = (
    <div className="space-y-5">
      <ViewSection title="DANFE / Visualização">
        <div className="rounded-lg border p-4 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">DANFE</p>
              <p className="text-xs text-muted-foreground">
                Documento Auxiliar da Nota Fiscal Eletrônica
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onDanfe(selected)}
          >
            <FileText className="h-3.5 w-3.5" /> Visualizar
          </Button>
        </div>
      </ViewSection>

      <ViewSection title="XML / Chave de Acesso">
        {temChaveAcesso ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-success/5 border-success/20 p-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success shrink-0" />
              <p className="text-xs text-success font-medium">
                Chave de acesso disponível — documento identificado como NF-e eletrônica
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chave (44 dígitos)
              </span>
              <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                <p className="font-mono text-xs break-all flex-1 leading-relaxed select-all">
                  {selected.chave_acesso}
                </p>
                <button
                  type="button"
                  onClick={copyChave}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copiar"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-4 flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-xs">
              Chave de acesso não informada. XML eletrônico não vinculado a este documento.
            </p>
          </div>
        )}
      </ViewSection>
    </div>
  );

  const tabVinculos = (
    <div className="space-y-5">
      <ViewSection title="Origem / Documento">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label={selected.tipo === "entrada" ? "Fornecedor" : "Cliente"}>
            {parceiroId ? (
              <RelationalLink type={parceiroType as "fornecedor" | "cliente"} id={parceiroId}>
                {parceiro}
              </RelationalLink>
            ) : (
              parceiro
            )}
          </ViewField>
          {selected.ordem_venda_id && selected.ordens_venda && (
            <ViewField label="Pedido de Origem">
              <RelationalLink type="ordem_venda" id={selected.ordem_venda_id}>
                <span className="font-mono">{selected.ordens_venda.numero}</span>
              </RelationalLink>
            </ViewField>
          )}
          {selected.nf_referenciada_id && (
            <ViewField label="NF Referenciada">
              <RelationalLink type="nota_fiscal" id={selected.nf_referenciada_id}>
                Ver NF de origem
              </RelationalLink>
            </ViewField>
          )}
        </div>
      </ViewSection>

      <ViewSection title="Impacto Financeiro">
        {loadingExtra ? (
          <p className="text-xs text-muted-foreground py-2">Carregando...</p>
        ) : lancamentos.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 shrink-0" />
            {selected.gera_financeiro === false
              ? "Esta NF não gera lançamentos financeiros (configuração desmarcada)."
              : selected.status === "pendente"
              ? "Lançamentos financeiros serão gerados ao confirmar a nota."
              : "Nenhum lançamento financeiro vinculado a esta NF."}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Descrição</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Vencimento</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l: any, idx: number) => (
                    <tr key={l.id || idx} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-3 py-2 truncate max-w-[140px]">{l.descricao || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">
                        {formatCurrency(Number(l.valor))}
                      </td>
                      <td className="px-3 py-2">
                        {l.data_vencimento ? formatDate(l.data_vencimento) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs capitalize">{l.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {lancamentos.length} lançamento(s) · total:{" "}
              <span className="font-mono font-semibold">
                {formatCurrency(lancamentos.reduce((s, l) => s + Number(l.valor || 0), 0))}
              </span>
            </p>
          </div>
        )}
      </ViewSection>

      {selected.movimenta_estoque !== false && (
        <ViewSection title="Impacto em Estoque">
          {loadingExtra ? (
            <p className="text-xs text-muted-foreground py-2">Carregando...</p>
          ) : movimentos.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 shrink-0" />
              {selected.status === "pendente"
                ? "Movimentos de estoque serão gerados ao confirmar a nota."
                : "Nenhum movimento de estoque vinculado a esta NF."}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Produto</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Tipo</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qtd</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentos.map((m: any, idx: number) => (
                    <tr key={m.id || idx} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-3 py-2 truncate max-w-[120px]">
                        {m.produtos?.id ? (
                          <RelationalLink type="produto" id={m.produtos.id}>
                            {m.produtos?.nome || "—"}
                          </RelationalLink>
                        ) : (
                          m.produtos?.nome || "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            m.tipo === "entrada"
                              ? "text-success border-success/30"
                              : "text-destructive border-destructive/30",
                          )}
                        >
                          {m.tipo === "entrada" ? "Entrada" : "Saída"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{m.quantidade}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {m.saldo_atual}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ViewSection>
      )}

      {items.some((i: any) => i.contas_contabeis) && (
        <ViewSection title="Contas Contábeis">
          <div className="space-y-1">
            {items
              .filter((i: any) => i.contas_contabeis)
              .map((i: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate">
                    {i.produtos?.nome || `Item ${idx + 1}`}
                  </span>
                  <span className="font-mono text-xs">
                    {i.contas_contabeis.codigo} – {i.contas_contabeis.descricao}
                  </span>
                </div>
              ))}
          </div>
        </ViewSection>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={`NF ${selected.numero} · Série ${selected.serie || "1"}`}
      subtitle={
        <span>
          <span className="font-medium">{parceiro}</span>
          {selected.data_emissao ? ` · ${formatDate(selected.data_emissao)}` : ""}
          {(selected.tipo_operacao || "normal") !== "normal" && (
            <span className="ml-1 text-warning font-medium capitalize">
              · {selected.tipo_operacao}
            </span>
          )}
        </span>
      }
      badge={<StatusBadge status={selected.status} />}
      summary={summary}
      actions={
        <>
          {canDevolucao && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-warning hover:text-warning"
                  onClick={() => { onClose(); onDevolucao(selected); }}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gerar Devolução</TooltipContent>
            </Tooltip>
          )}
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
                onClick={() => { onClose(); onDelete(selected.id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </>
      }
      tabs={[
        { value: "resumo", label: "Resumo", content: tabResumo },
        { value: "itens", label: `Itens (${items.length})`, content: tabItens },
        { value: "fiscal", label: "Fiscal", content: tabFiscal },
        { value: "arquivos", label: "Arquivos", content: tabArquivos },
        { value: "vinculos", label: "Vínculos", content: tabVinculos },
      ]}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onDanfe(selected)}
          >
            <FileText className="h-4 w-4" /> Visualizar DANFE
          </Button>
          {canConfirmar && (
            <Button
              className="w-full gap-2"
              onClick={() => { onConfirmar(selected); onClose(); }}
            >
              <CheckCircle className="h-4 w-4" /> Confirmar Nota Fiscal
            </Button>
          )}
          {canDevolucao && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { onClose(); onDevolucao(selected); }}
            >
              <ArrowLeftRight className="h-4 w-4" /> Gerar Nota de Devolução
            </Button>
          )}
          {canEstornar && (
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => { onEstornar(selected); onClose(); }}
            >
              <XCircle className="h-4 w-4" /> Estornar Nota Fiscal
            </Button>
          )}
        </div>
      }
    />
  );
}
