/**
 * LgpdSection — registro e execução de solicitações LGPD.
 *
 * Funcionalidades:
 *  - Listar solicitações registradas (exportação/anonimização) com status.
 *  - Nova solicitação: escolhe tipo de titular, busca por nome, escolhe ação.
 *      • Exportar → faz download de um JSON com tudo que o sistema guarda.
 *      • Anonimizar → substitui PII preservando NFs autorizadas e histórico financeiro.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Download, Loader2, Shield, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  anonimizarTitular,
  buscarTitulares,
  exportarTitular,
  listSolicitacoes,
  type LgpdSolicitacao,
  type TitularTipo,
} from "@/services/lgpd.service";

const TIPO_LABEL: Record<TitularTipo, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  funcionario: "Funcionário",
};

export function LgpdSection() {
  const [tipo, setTipo] = useState<TitularTipo>("cliente");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; descricao: string }>>([]);
  const [selecionado, setSelecionado] = useState<{ id: string; descricao: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmAnon, setConfirmAnon] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<LgpdSolicitacao[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    try {
      setSolicitacoes(await listSolicitacoes(50));
    } catch (e) {
      toast.error("Falha ao carregar solicitações");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await buscarTitulares(tipo, query.trim());
        if (!cancelled) setResults(res);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, tipo]);

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportar = async () => {
    if (!selecionado) return;
    setSubmitting(true);
    try {
      const data = await exportarTitular(tipo, selecionado.id);
      downloadJson(data, `lgpd-${tipo}-${selecionado.id}.json`);
      toast.success("Exportação concluída");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonimizar = async () => {
    if (!selecionado || motivo.trim().length < 5) return;
    setSubmitting(true);
    try {
      await anonimizarTitular(tipo, selecionado.id, motivo.trim());
      toast.success("Titular anonimizado. NFs autorizadas foram preservadas.");
      setSelecionado(null);
      setMotivo("");
      setQuery("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao anonimizar");
    } finally {
      setSubmitting(false);
      setConfirmAnon(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Conformidade LGPD</CardTitle>
          <CardDescription>
            Registre solicitações de titulares de dados. Exportações são entregues em JSON;
            anonimizações preservam integralmente notas fiscais autorizadas e histórico financeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Tipo de titular</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TitularTipo); setSelecionado(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buscar titular</Label>
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelecionado(null); }}
                placeholder="Digite nome ou razão social…"
              />
              {searching && <p className="text-xs text-muted-foreground">Buscando…</p>}
              {!searching && results.length > 0 && !selecionado && (
                <ul className="rounded-md border max-h-48 overflow-y-auto text-sm">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => { setSelecionado(r); setResults([]); setQuery(r.descricao); }}
                        className="w-full text-left px-3 py-2 hover:bg-accent"
                      >
                        {r.descricao}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selecionado && (
                <p className="text-xs text-success">Selecionado: {selecionado.descricao}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo (obrigatório para anonimização)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: solicitação formal do titular em 15/06/2026, protocolo #1234."
              rows={3}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportar} disabled={!selecionado || submitting} variant="outline">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar dados
            </Button>
            <Button
              onClick={() => setConfirmAnon(true)}
              disabled={!selecionado || submitting || motivo.trim().length < 5}
              variant="destructive"
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Anonimizar PII
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de solicitações</CardTitle>
          <CardDescription>Últimas 50 solicitações registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : solicitacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Data</th>
                    <th className="text-left font-medium">Titular</th>
                    <th className="text-left font-medium">Ação</th>
                    <th className="text-left font-medium">Status</th>
                    <th className="text-left font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoes.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                      <td>{TIPO_LABEL[s.titular_tipo]} · {s.titular_id.slice(0, 8)}…</td>
                      <td>{s.tipo === "exportar" ? "Exportação" : "Anonimização"}</td>
                      <td><Badge variant={s.status === "concluida" ? "default" : "secondary"}>{s.status}</Badge></td>
                      <td className="max-w-xs truncate text-muted-foreground">{s.motivo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmAnon}
        onClose={() => setConfirmAnon(false)}
        onConfirm={handleAnonimizar}
        title="Confirmar anonimização?"
        description={`Os dados pessoais do titular (${selecionado?.descricao ?? ""}) serão substituídos por valores anonimizados. Notas fiscais autorizadas e lançamentos financeiros históricos serão preservados. Esta ação é irreversível.`}
        confirmLabel="Anonimizar"
        confirmVariant="destructive"
      />
    </div>
  );
}