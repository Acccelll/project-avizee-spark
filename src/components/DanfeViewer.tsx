import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, Building2, Truck, DollarSign, Package } from "lucide-react";

interface DanfeItem {
  produto_id?: string;
  descricao?: string;
  quantidade: number;
  valor_unitario: number;
  cfop?: string;
  cst?: string;
  icms_valor?: number;
  ipi_valor?: number;
  pis_valor?: number;
  cofins_valor?: number;
}

interface DanfeData {
  numero: string;
  serie?: string;
  chave_acesso?: string;
  data_emissao: string;
  tipo: string;
  status: string;
  emitente?: { nome: string; cnpj?: string; endereco?: string; cidade?: string; uf?: string };
  destinatario?: { nome: string; cnpj?: string; endereco?: string; cidade?: string; uf?: string };
  itens: DanfeItem[];
  valor_total: number;
  frete_valor?: number;
  icms_valor?: number;
  ipi_valor?: number;
  pis_valor?: number;
  cofins_valor?: number;
  desconto_valor?: number;
  outras_despesas?: number;
  observacoes?: string;
  forma_pagamento?: string;
  condicao_pagamento?: string;
}

interface DanfeViewerProps {
  open: boolean;
  onClose: () => void;
  data: DanfeData | null;
}

const StatusLabel: Record<string, string> = {
  pendente: "Pendente",
  emitida: "Emitida",
  cancelada: "Cancelada",
  denegada: "Denegada",
};

export function DanfeViewer({ open, onClose, data }: DanfeViewerProps) {
  if (!data) return null;

  const totalProdutos = data.itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            DANFE — NF {data.numero}
            {data.serie && <span className="text-muted-foreground text-sm">Série {data.serie}</span>}
          </DialogTitle>
          <DialogDescription>
            Visualização simplificada do Documento Auxiliar da Nota Fiscal Eletrônica.
          </DialogDescription>
        </DialogHeader>

        {/* Header bar */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Badge variant={data.tipo === "entrada" ? "secondary" : "default"}>
              {data.tipo === "entrada" ? "ENTRADA" : "SAÍDA"}
            </Badge>
            <Badge variant={data.status === "emitida" ? "default" : data.status === "cancelada" ? "destructive" : "outline"}>
              {StatusLabel[data.status] || data.status}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">{formatDate(data.data_emissao)}</span>
        </div>

        {/* Chave de acesso */}
        {data.chave_acesso && (
          <div className="bg-muted/30 rounded p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Chave de Acesso</p>
            <p className="font-mono text-xs tracking-widest break-all">{data.chave_acesso}</p>
          </div>
        )}

        {/* Emitente / Destinatário */}
        <div className="grid grid-cols-2 gap-4">
          {data.emitente && (
            <div className="border rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> EMITENTE</p>
              <p className="font-semibold text-sm">{data.emitente.nome}</p>
              {data.emitente.cnpj && <p className="text-xs font-mono text-muted-foreground">{data.emitente.cnpj}</p>}
              {data.emitente.endereco && <p className="text-xs text-muted-foreground">{data.emitente.endereco}</p>}
              {data.emitente.cidade && <p className="text-xs text-muted-foreground">{data.emitente.cidade}{data.emitente.uf ? ` - ${data.emitente.uf}` : ""}</p>}
            </div>
          )}
          {data.destinatario && (
            <div className="border rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> DESTINATÁRIO</p>
              <p className="font-semibold text-sm">{data.destinatario.nome}</p>
              {data.destinatario.cnpj && <p className="text-xs font-mono text-muted-foreground">{data.destinatario.cnpj}</p>}
              {data.destinatario.endereco && <p className="text-xs text-muted-foreground">{data.destinatario.endereco}</p>}
              {data.destinatario.cidade && <p className="text-xs text-muted-foreground">{data.destinatario.cidade}{data.destinatario.uf ? ` - ${data.destinatario.uf}` : ""}</p>}
            </div>
          )}
        </div>

        {/* Itens */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2"><Package className="w-3 h-3" /> ITENS ({data.itens.length})</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-center">CFOP</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Vlr Unit</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2">{item.descricao || "—"}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{item.cfop || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.valor_unitario)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(item.quantidade * item.valor_unitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* Totais */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> TOTAIS</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Produtos</p>
              <p className="font-mono font-semibold">{formatCurrency(totalProdutos)}</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Frete</p>
              <p className="font-mono">{formatCurrency(data.frete_valor || 0)}</p>
            </div>
            <div className="bg-muted/30 rounded p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Desconto</p>
              <p className="font-mono text-destructive">-{formatCurrency(data.desconto_valor || 0)}</p>
            </div>
            <div className="bg-primary/10 rounded p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Total NF</p>
              <p className="font-mono font-bold text-primary">{formatCurrency(data.valor_total)}</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {[
              { label: "ICMS", value: data.icms_valor },
              { label: "IPI", value: data.ipi_valor },
              { label: "PIS", value: data.pis_valor },
              { label: "COFINS", value: data.cofins_valor },
              { label: "Outras Desp.", value: data.outras_despesas },
            ].map((t) => (
              <div key={t.label} className="text-center">
                <p className="text-[10px] text-muted-foreground">{t.label}</p>
                <p className="font-mono text-xs">{formatCurrency(t.value || 0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pagamento / Observações */}
        {(data.forma_pagamento || data.observacoes) && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              {data.forma_pagamento && (
                <div>
                  <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                  <p>{data.forma_pagamento}</p>
                </div>
              )}
              {data.condicao_pagamento && (
                <div>
                  <p className="text-xs text-muted-foreground">Condição</p>
                  <p>{data.condicao_pagamento}</p>
                </div>
              )}
            </div>
            {data.observacoes && (
              <div>
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{data.observacoes}</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
