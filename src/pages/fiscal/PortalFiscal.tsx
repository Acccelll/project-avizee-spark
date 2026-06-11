/**
 * Portal Fiscal — consulta unificada de NF-e estilo TOTVS Processos Fiscais.
 *
 * Fonte: view `v_nfe_portal` + RPC `buscar_nfe_portal` (filtros server-side).
 * Ações por linha: ver XML, baixar XML, sincronizar SEFAZ no header.
 * Sem nova tabela — herda RLS de `nfe_distribuicao`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sincronizarDistDFe } from "@/services/fiscal/sefaz";
import type { DanfeInput } from "@/services/fiscal/danfe.service";
import { parseNfeXmlToDanfeInput } from "@/services/fiscal/nfeXmlToDanfe";
import { DanfeRender, DANFE_CONTAINER_ID, downloadDanfeFromDom } from "./components/DanfeRender";

interface PortalRow {
  id: string;
  chave_acesso: string;
  nsu: string | null;
  tipo_documento: string;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  uf_emitente: string | null;
  valor_total: number | null;
  status_manifestacao: string;
  processado: boolean;
  tem_xml: boolean;
  status_interno: string | null;
  status_sefaz: string | null;
  tipo_operacao: string | null;
}

interface Filtros {
  data_inicio: string;
  data_fim: string;
  chave: string;
  cnpj_emitente: string;
  emitente: string;
  uf: string;
  serie: string;
  numero_ini: string;
  numero_fim: string;
  status_manifestacao: string;
  tipo_documento: string;
}

const FILTROS_VAZIOS: Filtros = {
  data_inicio: "",
  data_fim: "",
  chave: "",
  cnpj_emitente: "",
  emitente: "",
  uf: "",
  serie: "",
  numero_ini: "",
  numero_fim: "",
  status_manifestacao: "todos",
  tipo_documento: "todos",
};

const STATUS_LABEL: Record<string, string> = {
  sem_manifestacao: "Sem manifestação",
  ciencia: "Ciência",
  ciencia_operacao: "Ciência da operação",
  confirmada: "Confirmada",
  desconhecida: "Desconhecida",
  nao_realizada: "Não realizada",
};

const PAGE_SIZE = 50;

function defaultPeriodo(): { ini: string; fim: string } {
  const fim = new Date();
  const ini = new Date();
  ini.setDate(ini.getDate() - 30);
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export default function PortalFiscal() {
  const periodo = useMemo(defaultPeriodo, []);
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...FILTROS_VAZIOS,
    data_inicio: periodo.ini,
    data_fim: periodo.fim,
  }));
  const [aplicados, setAplicados] = useState<Filtros>(() => ({
    ...FILTROS_VAZIOS,
    data_inicio: periodo.ini,
    data_fim: periodo.fim,
  }));
  const [rows, setRows] = useState<PortalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [xmlOpen, setXmlOpen] = useState<PortalRow | null>(null);
  const [xmlConteudo, setXmlConteudo] = useState<string>("");
  const [carregandoXml, setCarregandoXml] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);
  const [danfePreview, setDanfePreview] = useState<{ data: DanfeInput; row: PortalRow } | null>(null);

  const buscar = useCallback(
    async (f: Filtros, p: number) => {
      setLoading(true);
      try {
        const payload: Record<string, string> = {};
        if (f.data_inicio) payload.data_inicio = `${f.data_inicio}T00:00:00`;
        if (f.data_fim) payload.data_fim = `${f.data_fim}T23:59:59`;
        if (f.chave) payload.chave = f.chave.replace(/\D/g, "");
        if (f.cnpj_emitente) payload.cnpj_emitente = f.cnpj_emitente;
        if (f.emitente) payload.emitente = f.emitente;
        if (f.uf) payload.uf = f.uf;
        if (f.serie) payload.serie = f.serie;
        if (f.numero_ini) payload.numero_ini = f.numero_ini;
        if (f.numero_fim) payload.numero_fim = f.numero_fim;
        if (f.status_manifestacao && f.status_manifestacao !== "todos")
          payload.status_manifestacao = f.status_manifestacao;
        if (f.tipo_documento && f.tipo_documento !== "todos")
          payload.tipo_documento = f.tipo_documento;

        const { data, error } = await supabase.rpc("buscar_nfe_portal", {
          p_filtros: payload,
          p_limit: PAGE_SIZE,
          p_offset: p * PAGE_SIZE,
        });
        if (error) throw error;
        const r =
          (data as unknown as { rows: PortalRow[]; total: number } | null) ?? {
            rows: [],
            total: 0,
          };
        setRows(r.rows ?? []);
        setTotal(Number(r.total ?? 0));
      } catch (e) {
        toast.error("Erro ao consultar NF-e", {
          description: e instanceof Error ? e.message : String(e),
        });
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void buscar(aplicados, page);
  }, [aplicados, page, buscar]);

  const aplicarFiltros = () => {
    setPage(0);
    setAplicados({ ...filtros });
  };

  const limpar = () => {
    const novos = { ...FILTROS_VAZIOS, data_inicio: periodo.ini, data_fim: periodo.fim };
    setFiltros(novos);
    setAplicados(novos);
    setPage(0);
  };

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const r = await sincronizarDistDFe();
      if (r.sucesso) {
        toast.success("Sincronização concluída", {
          description: `${r.novos} nova(s), ${r.duplicados} existente(s).`,
        });
        void buscar(aplicados, page);
      } else {
        toast.error("Falha na sincronização", {
          description: r.erro ?? r.xMotivo ?? `cStat ${r.cStat ?? "?"}`,
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const exportarCsv = () => {
    if (rows.length === 0) {
      toast.info("Nada a exportar");
      return;
    }
    const headers = [
      "Chave",
      "Série",
      "Número",
      "Emissão",
      "Emitente",
      "CNPJ Emitente",
      "UF",
      "Valor",
      "Status",
      "Manifestação",
    ];
    const linhas = rows.map((r) => [
      r.chave_acesso,
      r.serie ?? "",
      r.numero ?? "",
      r.data_emissao ?? "",
      (r.nome_emitente ?? "").replace(/[;\n\r]/g, " "),
      r.cnpj_emitente ?? "",
      r.uf_emitente ?? "",
      r.valor_total != null ? String(r.valor_total) : "",
      r.status_interno ?? r.status_sefaz ?? "",
      STATUS_LABEL[r.status_manifestacao] ?? r.status_manifestacao,
    ]);
    const csv = [headers, ...linhas]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portal-nfe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarXml = async (row: PortalRow) => {
    const { data, error } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe")
      .eq("id", row.id)
      .maybeSingle();
    const xml = (data as { xml_nfe?: string | null } | null)?.xml_nfe;
    if (error || !xml) {
      toast.error("XML não disponível", {
        description:
          "Esta nota ainda está apenas como resumo (resNFe). Aplique Ciência da operação para receber o XML completo.",
      });
      return;
    }
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.chave_acesso}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const carregarXmlDaLinha = async (row: PortalRow): Promise<string | null> => {
    const { data } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe")
      .eq("id", row.id)
      .maybeSingle();
    return (data as { xml_nfe?: string | null } | null)?.xml_nfe ?? null;
  };

  const sanitizeFilename = (s: string): string =>
    s
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const gerarPdf = async (row: PortalRow, modo: "preview" | "download") => {
    if (gerandoPdfId) return;
    setGerandoPdfId(row.id);
    try {
      const xml = await carregarXmlDaLinha(row);
      if (!xml) {
        toast.error("XML não disponível", {
          description:
            "Esta nota ainda está apenas como resumo (resNFe). Aplique Ciência da operação para receber o XML completo.",
        });
        return;
      }
      const danfe = parseNfeXmlToDanfeInput(xml);
      if (modo === "preview") {
        setDanfePreview({ data: danfe, row });
      } else {
        // Garante que o nó esteja montado no DOM (abre o preview invisível se necessário).
        const ensureMounted = !document.getElementById(DANFE_CONTAINER_ID);
        if (ensureMounted) setDanfePreview({ data: danfe, row });
        // Aguarda render no próximo frame.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const numero = sanitizeFilename(row.numero ?? danfe.numero ?? "NF");
        const emit = sanitizeFilename(row.nome_emitente ?? danfe.emitente.razao_social ?? "emitente");
        await downloadDanfeFromDom(DANFE_CONTAINER_ID, `${numero} - ${emit}.pdf`);
      }
    } catch (e) {
      toast.error("Falha ao gerar DANFE", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setGerandoPdfId(null);
    }
  };

  const fecharPreview = () => setDanfePreview(null);

  const baixarDanfeAtual = async () => {
    if (!danfePreview) return;
    const { data, row } = danfePreview;
    const numero = sanitizeFilename(row.numero ?? data.numero ?? "NF");
    const emit = sanitizeFilename(row.nome_emitente ?? data.emitente.razao_social ?? "emitente");
    try {
      await downloadDanfeFromDom(DANFE_CONTAINER_ID, `${numero} - ${emit}.pdf`);
    } catch (e) {
      toast.error("Falha ao gerar PDF", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const verXml = async (row: PortalRow) => {
    setXmlOpen(row);
    setCarregandoXml(true);
    setXmlConteudo("");
    const { data } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe")
      .eq("id", row.id)
      .maybeSingle();
    const xml = (data as { xml_nfe?: string | null } | null)?.xml_nfe;
    setXmlConteudo(xml ?? "");
    setCarregandoXml(false);
  };

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fiscal" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Portal NF-e</h1>
            <p className="text-sm text-muted-foreground">
              Consulta unificada de documentos fiscais recebidos via SEFAZ DistDF-e.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => void sincronizar()} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar SEFAZ
          </Button>
          <Button variant="outline" onClick={exportarCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <Label htmlFor="di">Data inicial</Label>
              <Input
                id="di"
                type="date"
                value={filtros.data_inicio}
                onChange={(e) => setFiltros((f) => ({ ...f, data_inicio: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="df">Data final</Label>
              <Input
                id="df"
                type="date"
                value={filtros.data_fim}
                onChange={(e) => setFiltros((f) => ({ ...f, data_fim: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="uf">UF emitente</Label>
              <Input
                id="uf"
                maxLength={2}
                placeholder="SP"
                value={filtros.uf}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, uf: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div>
              <Label htmlFor="serie">Série</Label>
              <Input
                id="serie"
                value={filtros.serie}
                onChange={(e) => setFiltros((f) => ({ ...f, serie: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="num_ini">Nº inicial</Label>
              <Input
                id="num_ini"
                inputMode="numeric"
                value={filtros.numero_ini}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, numero_ini: e.target.value.replace(/\D/g, "") }))
                }
              />
            </div>
            <div>
              <Label htmlFor="num_fim">Nº final</Label>
              <Input
                id="num_fim"
                inputMode="numeric"
                value={filtros.numero_fim}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, numero_fim: e.target.value.replace(/\D/g, "") }))
                }
              />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Label htmlFor="chave">Chave de acesso (44 dígitos)</Label>
              <Input
                id="chave"
                value={filtros.chave}
                placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                onChange={(e) => setFiltros((f) => ({ ...f, chave: e.target.value }))}
              />
            </div>
            <div className="col-span-2 md:col-span-2">
              <Label htmlFor="emit">Emitente (nome)</Label>
              <Input
                id="emit"
                value={filtros.emitente}
                onChange={(e) => setFiltros((f) => ({ ...f, emitente: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ emitente</Label>
              <Input
                id="cnpj"
                value={filtros.cnpj_emitente}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, cnpj_emitente: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Manifestação</Label>
              <Select
                value={filtros.status_manifestacao}
                onValueChange={(v) => setFiltros((f) => ({ ...f, status_manifestacao: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="sem_manifestacao">Sem manifestação</SelectItem>
                  <SelectItem value="ciencia">Ciência</SelectItem>
                  <SelectItem value="ciencia_operacao">Ciência da operação</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="desconhecida">Desconhecida</SelectItem>
                  <SelectItem value="nao_realizada">Não realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={filtros.tipo_documento}
                onValueChange={(v) => setFiltros((f) => ({ ...f, tipo_documento: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="procNFe">NF-e completa</SelectItem>
                  <SelectItem value="resNFe">Apenas resumo</SelectItem>
                  <SelectItem value="procEventoNFe">Evento</SelectItem>
                  <SelectItem value="resEvento">Resumo de evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={aplicarFiltros} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="outline" onClick={limpar} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {loading ? "Buscando…" : `${total} documento(s)`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum documento encontrado para os filtros aplicados.
              <div className="mt-2">
                Em ambiente de homologação a SEFAZ não devolve NF-e reais —
                migre para produção em Configurações Fiscais para popular o portal.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Série</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead className="w-12">UF</TableHead>
                    <TableHead>Manifestação</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.serie ?? "—"}</TableCell>
                      <TableCell className="font-medium">{r.numero ?? "—"}</TableCell>
                      <TableCell>
                        {r.data_emissao
                          ? format(new Date(r.data_emissao), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate" title={r.nome_emitente ?? ""}>
                        <div className="font-medium">{r.nome_emitente ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.cnpj_emitente ?? ""}
                        </div>
                      </TableCell>
                      <TableCell>{r.uf_emitente ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.status_manifestacao === "sem_manifestacao" ? "secondary" : "default"}>
                          {STATUS_LABEL[r.status_manifestacao] ?? r.status_manifestacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {r.tipo_documento === "procNFe"
                            ? "NF-e"
                            : r.tipo_documento === "resNFe"
                              ? "Resumo"
                              : r.tipo_documento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.valor_total != null
                          ? r.valor_total.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Ver XML"
                            onClick={() => void verXml(r)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Baixar XML"
                            onClick={() => void baixarXml(r)}
                            disabled={!r.tem_xml}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Visualizar DANFE PDF"
                            onClick={() => void gerarPdf(r, "preview")}
                            disabled={
                              !r.tem_xml ||
                              r.tipo_documento !== "procNFe" ||
                              gerandoPdfId === r.id
                            }
                          >
                            {gerandoPdfId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Baixar DANFE PDF"
                            onClick={() => void gerarPdf(r, "download")}
                            disabled={
                              !r.tem_xml ||
                              r.tipo_documento !== "procNFe" ||
                              gerandoPdfId === r.id
                            }
                          >
                            <Download className="h-4 w-4 text-primary" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground">
                Página {page + 1} de {totalPaginas}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPaginas || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!xmlOpen} onOpenChange={(v) => !v && setXmlOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              XML — Série {xmlOpen?.serie ?? "—"} · Nº {xmlOpen?.numero ?? "—"}
            </DialogTitle>
          </DialogHeader>
          {carregandoXml ? (
            <Skeleton className="h-72 w-full" />
          ) : xmlConteudo ? (
            <pre className="text-[11px] bg-muted/40 rounded p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
              {xmlConteudo}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              XML completo ainda não disponível. Aplique Ciência da operação
              para que a SEFAZ libere o procNFe.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!danfePreview} onOpenChange={(v) => !v && fecharPreview()}>
        <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b bg-background">
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">
                DANFE — Nº {danfePreview?.row.numero ?? "—"} ·{" "}
                {danfePreview?.row.nome_emitente ?? "—"}
              </span>
              {danfePreview && (
                <Button size="sm" onClick={() => void baixarDanfeAtual()}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {danfePreview && (
            <div className="overflow-auto bg-neutral-200 p-4" style={{ maxHeight: "80vh" }}>
              <div className="shadow-lg">
                <DanfeRender data={danfePreview.data} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}