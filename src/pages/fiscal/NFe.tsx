import { useState } from "react";
import { Plus, Search } from "lucide-react";
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
import { NFeForm } from "./components/NFeForm";
import { SefazRetornoModal } from "./components/SefazRetornoModal";
import { useNFe, useNFeMutation } from "./hooks/useNFe";
import { useSefazAutorizacao } from "./hooks/useSefazAutorizacao";
import type { NFeFormData } from "./components/NFeForm/schema";
import type { AutorizacaoResult } from "@/services/fiscal/sefaz";

export default function NFe() {
  const [search, setSearch] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [retorno, setRetorno] = useState<AutorizacaoResult | null>(null);

  const { data: nfes, isLoading } = useNFe({ search });
  const { criar } = useNFeMutation();
  const autorizacao = useSefazAutorizacao({
    onSucesso: (result) => setRetorno(result),
  });

  function handleSubmit(data: NFeFormData) {
    criar.mutate(
      {
        numero: data.numero,
        serie: data.serie,
        data_emissao: data.dataEmissao,
        tipo_operacao: data.tipoOperacao,
        forma_pagamento: data.formaPagamento,
        condicao_pagamento: data.condicaoPagamento,
        frete_valor: data.freteValor,
        desconto_valor: data.descontoValor,
        outras_despesas: data.outrasDespesas,
        observacoes: data.observacoes,
        status: "rascunho",
        tipo: data.tipoOperacao,
      },
      { onSuccess: () => setFormAberto(false) },
    );
  }

  function statusBadge(status: string | null) {
    const map: Record<string, string> = {
      rascunho: "secondary",
      autorizada: "default",
      cancelada: "destructive",
      rejeitada: "destructive",
    };
    return <Badge variant={(map[status ?? ""] as "default" | "secondary" | "destructive") ?? "secondary"}>{status ?? "—"}</Badge>;
  }

  return (
    <div className="space-y-4 p-6">
      <CertificadoValidadeAlert />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nota Fiscal Eletrônica (NF-e)</h1>
        <Button onClick={() => setFormAberto(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova NF-e
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma NF-e encontrada.
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
