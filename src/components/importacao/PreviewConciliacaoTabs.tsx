import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, XCircle, Link2, FileWarning } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import type { PreviewConciliacaoBundle, PreviewFinanceiroLinha } from "@/hooks/importacao/useImportacaoConciliacao";

interface Props {
  preview: PreviewConciliacaoBundle;
}

function StatusCell({ row }: { row: PreviewFinanceiroLinha }) {
  if (!row._valid) return <XCircle className="h-4 w-4 text-rose-500" aria-label="Erro" />;
  if (row._duplicado) return <FileWarning className="h-4 w-4 text-amber-500" aria-label="Duplicado" />;
  if (row._match === "pendente" && row.origem !== "FOPAG")
    return <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Pendente vínculo" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="OK" />;
}

function MatchBadge({ via }: { via: PreviewFinanceiroLinha["_match"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    codigo_legado: { label: "código", cls: "bg-emerald-100 text-emerald-700" },
    cpf_cnpj: { label: "doc.", cls: "bg-emerald-100 text-emerald-700" },
    nome: { label: "nome", cls: "bg-blue-100 text-blue-700" },
    pendente: { label: "pendente", cls: "bg-amber-100 text-amber-700" },
  };
  const m = map[via];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function FinanceiroBlock({ rows, label }: { rows: PreviewFinanceiroLinha[]; label: string }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma linha em {label}.</p>;
  return (
    <div className="rounded-md border bg-card max-h-[460px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50">
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Pessoa</TableHead>
            <TableHead>Vínculo</TableHead>
            <TableHead>Conta Contábil</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Avisos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell><StatusCell row={r} /></TableCell>
              <TableCell className="text-xs">{r.data_vencimento ? format(parseISO(r.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
              <TableCell className="max-w-[180px] truncate text-xs">
                <span className="font-medium">{r.nome_abreviado ?? "—"}</span>
                {r.codigo_legado_pessoa && <span className="text-muted-foreground"> · #{r.codigo_legado_pessoa}</span>}
              </TableCell>
              <TableCell><MatchBadge via={r._match} /></TableCell>
              <TableCell className="font-mono text-[11px]">{r.conta_contabil_codigo ?? "—"}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatCurrency(r.valor)}</TableCell>
              <TableCell className="text-xs">{r.titulo ?? "—"}</TableCell>
              <TableCell className="text-[10px] text-amber-700">
                {r._errors.length > 0 && <div className="text-rose-600">{r._errors.join("; ")}</div>}
                {r._warnings.length > 0 && <div>{r._warnings.join("; ")}</div>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PreviewConciliacaoTabs({ preview }: Props) {
  const pendentes = [...preview.cr, ...preview.cp].filter((x) => x._match === "pendente");

  return (
    <div className="space-y-4">
      {/* Cards-resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard title="CR (Receber)" value={preview.cr.length} sub={`${preview.cr.filter((x) => x._valid).length} válidos`} />
        <SummaryCard title="CP (Pagar)" value={preview.cp.length} sub={`${preview.cp.filter((x) => x._valid).length} válidos`} />
        <SummaryCard title="FOPAG" value={preview.fopag.length} sub="origem: pagar" />
        <SummaryCard title="Plano de Contas" value={preview.plano.length} sub={`${preview.plano.filter((x) => x._action === "criar").length} novos`} />
        <SummaryCard
          title="FC (conferência)"
          value={preview.fc.length}
          sub={`${preview.reconciliacao.divergencias} divergências`}
          tone={preview.reconciliacao.divergencias > 0 ? "warn" : "ok"}
        />
      </div>

      {preview.abasFaltantes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Abas não encontradas na planilha: <strong>{preview.abasFaltantes.join(", ")}</strong>. O fluxo segue, mas verifique se o arquivo está completo.</span>
        </div>
      )}

      <Tabs defaultValue="cr" className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="cr">CR <Badge variant="secondary" className="ml-1">{preview.cr.length}</Badge></TabsTrigger>
          <TabsTrigger value="cp">CP <Badge variant="secondary" className="ml-1">{preview.cp.length}</Badge></TabsTrigger>
          <TabsTrigger value="fopag">FOPAG <Badge variant="secondary" className="ml-1">{preview.fopag.length}</Badge></TabsTrigger>
          <TabsTrigger value="plano">Plano <Badge variant="secondary" className="ml-1">{preview.plano.length}</Badge></TabsTrigger>
          <TabsTrigger value="fc">FC <Badge variant="secondary" className="ml-1">{preview.fc.length}</Badge></TabsTrigger>
          <TabsTrigger value="pend">Pendências <Badge variant="secondary" className="ml-1">{pendentes.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="cr"><FinanceiroBlock rows={preview.cr} label="CR" /></TabsContent>
        <TabsContent value="cp"><FinanceiroBlock rows={preview.cp} label="CP" /></TabsContent>
        <TabsContent value="fopag"><FinanceiroBlock rows={preview.fopag} label="FOPAG" /></TabsContent>

        <TabsContent value="plano">
          {preview.plano.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta contábil na planilha.</p>
          ) : (
            <div className="rounded-md border bg-card max-h-[460px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>i-Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.plano.map((p) => (
                    <TableRow key={p._originalLine}>
                      <TableCell>
                        <Badge variant={p._action === "criar" ? "default" : "outline"}>{p._action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell className="text-xs">{p.descricao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.i_level ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="fc">
          <div className="text-xs text-muted-foreground mb-2">
            FC é exibido apenas para conferência — <strong>nunca</strong> gera lançamentos. Linhas sem
            correspondência em CR/CP/FOPAG aparecem destacadas.
          </div>
          <div className="rounded-md border bg-card max-h-[460px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50">
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conferência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.reconciliacao.detalhes.map((d, i) => (
                  <TableRow key={i} className={d.encontrado ? "" : "bg-amber-50/50"}>
                    <TableCell className="text-xs">{d.fc.data_vencimento ? format(parseISO(d.fc.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-xs">{d.fc.tipo_raw}</TableCell>
                    <TableCell className="text-xs">{d.fc.nome_abreviado ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(d.fc.valor)}</TableCell>
                    <TableCell className="text-xs">{d.fc.status ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {d.encontrado
                        ? <span className="text-emerald-600">✓ bate com CR/CP/FOPAG</span>
                        : <span className="text-amber-700">⚠ {d.divergencia}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pend">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma pendência de vínculo. Todos os títulos foram associados.</p>
          ) : (
            <div className="rounded-md border bg-card max-h-[460px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome Abreviado</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs"><Badge variant="outline">{r.origem}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.codigo_legado_pessoa ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.nome_abreviado ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.data_vencimento ? format(parseISO(r.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(r.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-3 text-[11px] text-muted-foreground border-t flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                Importe primeiro Clientes/Fornecedores correspondentes para resolver os vínculos automaticamente.
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  tone = "default",
}: {
  title: string;
  value: number;
  sub?: string;
  tone?: "default" | "ok" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50"
      : tone === "ok"
        ? "border-emerald-300 bg-emerald-50/40"
        : "bg-card";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-xl font-bold">{value.toLocaleString("pt-BR")}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
