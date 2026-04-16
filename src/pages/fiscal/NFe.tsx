import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CertificadoValidadeAlert } from "@/components/fiscal/CertificadoValidadeAlert";
import { EmptyState } from "@/components/ui/empty-state";
import { NFeForm } from "./components/NFeForm";
import { SefazRetornoModal } from "./components/SefazRetornoModal";
import { useNFe, useNFeMutation } from "./hooks/useNFe";
import { useSefazAutorizacao } from "./hooks/useSefazAutorizacao";
import { exportarParaExcel, exportarParaPdf } from "@/services/export.service";
import type { NFeFormData } from "./components/NFeForm/schema";
import type { AutorizacaoResult } from "@/services/fiscal/sefaz";

export default function NFe() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const statusFiltro = searchParams.get("status") ?? "";
  const dataInicio = searchParams.get("data_inicio") ?? "";
  const dataFim = searchParams.get("data_fim") ?? "";

  const [formAberto, setFormAberto] = useState(false);
  const [retorno, setRetorno] = useState<AutorizacaoResult | null>(null);

  const { data: nfes, isLoading } = useNFe({ search, status: statusFiltro || undefined, dataInicio: dataInicio || undefined, dataFim: dataFim || undefined });
  const { criar } = useNFeMutation();
  const autorizacao = useSefazAutorizacao({
    onSucesso: (result) => setRetorno(result),
  });

  function setSearch(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("search", value); else next.delete("search");
      return next;
    }, { replace: true });
  }

  function setStatus(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("status", value); else next.delete("status");
      return next;
    }, { replace: true });
  }

  function setDataInicio(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("data_inicio", value); else next.delete("data_inicio");
      return next;
    }, { replace: true });
  }

  function setDataFim(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("data_fim", value); else next.delete("data_fim");
      return next;
    }, { replace: true });
  }

  async function handleExportarExcel() {
    const rows = (nfes ?? []).map((nf) => ({
      Número: nf.numero ?? "",
      Série: nf.serie ?? "",
      "Data Emissão": nf.data_emissao ?? "",
      "Valor Total": nf.valor_total ?? 0,
      Status: nf.status ?? "",
    }));
    await exportarParaExcel({ titulo: "NF-e", rows });
  }

  async function handleExportarPdf() {
    const rows = (nfes ?? []).map((nf) => ({
      Número: nf.numero ?? "",
      Série: nf.serie ?? "",
      "Data Emissão": nf.data_emissao ?? "",
      "Valor Total": nf.valor_total ?? 0,
      Status: nf.status ?? "",
    }));
    await exportarParaPdf({ titulo: "NF-e", rows });
  }

  function handleSubmit(data: NFeFormData) {
    // NOTE: This specialized flow currently only persists header fields.
    // Items (data.itens), clienteId, and fornecedorId from the form are NOT
    // saved because this path targets the `notas_fiscais` table directly without
    // the full Fiscal.tsx orchestration. Use the main Fiscal module for complete NF creation.
    criar.mutate(
      {
        numero: data.numero,
        serie: data.serie,
        data_emissao: data.dataEmissao,
        natureza_operacao: data.naturezaOperacao,
        tipo_operacao: data.tipoOperacao,
        forma_pagamento: data.formaPagamento,
        condicao_pagamento: data.condicaoPagamento,
        frete_valor: data.freteValor,
        desconto_valor: data.descontoValor,
        outras_despesas: data.outrasDespesas,
        observacoes: data.observacoes,
        cliente_id: data.clienteId || null,
        fornecedor_id: data.fornecedorId || null,
        status: "rascunho",
        tipo: data.tipoOperacao,
        modelo_documento: "55",
      },
      { onSuccess: () => setFormAberto(false) },
    );
  }

  function statusBadge(status: string | null) {
    const map: Record<string, string> = {
      rascunho:        "secondary",
      pendente:        "secondary",
      confirmada:      "default",
      autorizada:      "default",
      cancelada:       "destructive",
      cancelada_sefaz: "destructive",
      rejeitada:       "destructive",
      inutilizada:     "secondary",
    };
    return <Badge variant={(map[status ?? ""] as "default" | "secondary" | "destructive") ?? "secondary"}>{status ?? "—"}</Badge>;
  }

  return (
    <div className="space-y-4 p-6">
      <CertificadoValidadeAlert />

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
        <span className="text-primary text-sm mt-0.5">ℹ️</span>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Fluxo especializado NF-e:</span>{" "}
          Esta tela cria rascunhos NF-e com dados básicos. Para criação completa com itens,
          parceiro e confirmação fiscal, use o{" "}
          <a href="/fiscal" className="underline text-primary font-medium">módulo Fiscal principal</a>.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nota Fiscal Eletrônica (NF-e)</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportarExcel} aria-label="Exportar NF-e para Excel">
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportarPdf} aria-label="Exportar NF-e para PDF">
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button onClick={() => setFormAberto(true)} aria-label="Nova NF-e">
            <Plus className="mr-2 h-4 w-4" />
            Nova NF-e
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="w-40"
          placeholder="Data início"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="w-40"
          placeholder="Data fim"
        />
        <select
          value={statusFiltro}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="pendente">Pendente</option>
          <option value="confirmada">Confirmada</option>
          <option value="autorizada">Autorizada</option>
          <option value="cancelada">Cancelada</option>
          <option value="cancelada_sefaz">Cancelada SEFAZ</option>
          <option value="rejeitada">Rejeitada</option>
          <option value="inutilizada">Inutilizada</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Série</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (nfes ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-0">
                  <EmptyState title="Nenhuma NF-e encontrada" description="Tente ajustar os filtros ou emita uma nova NF-e." />
                </TableCell>
              </TableRow>
            ) : (
              (nfes ?? []).map((nf) => (
                <TableRow key={nf.id}>
                  <TableCell>{nf.numero ?? "—"}</TableCell>
                  <TableCell>{nf.serie ?? "—"}</TableCell>
                  <TableCell>{nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>{nf.valor_total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—"}</TableCell>
                  <TableCell>{statusBadge(nf.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formAberto} onOpenChange={setFormAberto}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nova NF-e</DialogTitle>
          </DialogHeader>
          <NFeForm onSubmit={handleSubmit} disabled={criar.isPending || autorizacao.isPending} />
        </DialogContent>
      </Dialog>

      <SefazRetornoModal
        aberto={!!retorno}
        onFechar={() => setRetorno(null)}
        protocolo={retorno?.protocolo}
        status={retorno?.status}
        motivo={retorno?.motivo}
        xmlRetorno={retorno?.xmlAutorizado}
      />
    </div>
  );
}
