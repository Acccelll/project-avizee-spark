/**
 * WebhooksSection — gestão de webhooks de saída (admin).
 *
 * Lista endpoints configurados, mostra contadores, permite criar/editar/
 * desativar e rotacionar segredo. Mostra também as últimas entregas
 * (sucesso/falha/pendente) com possibilidade de filtrar por endpoint.
 */

import { useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, Clock, Copy, Loader2, Plug, Plus,
  RefreshCw, RotateCcw, Send, Trash2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import {
  useWebhookDeliveries, useWebhookEndpoints, useWebhookMetrics, useWebhookMutations,
} from "@/pages/admin/hooks/useWebhooks";
import { WEBHOOK_EVENTOS, type WebhookEndpoint, type WebhookEventoStatus } from "@/services/webhooks.service";

function formatRel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusBadge(status: WebhookEventoStatus | null) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const map: Record<WebhookEventoStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    sucesso: { label: "Sucesso", cls: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30", Icon: CheckCircle2 },
    falha: { label: "Falha", cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: XCircle },
    pendente: { label: "Pendente", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30", Icon: Clock },
    cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border", Icon: AlertCircle },
  };
  const { label, cls, Icon } = map[status];
  return <Badge variant="outline" className={cls}><Icon className="h-3 w-3 mr-1" />{label}</Badge>;
}

export function WebhooksSection() {
  const endpoints = useWebhookEndpoints();
  const metrics = useWebhookMetrics();
  const [filterEndpoint, setFilterEndpoint] = useState<string | undefined>(undefined);
  const deliveries = useWebhookDeliveries({ endpointId: filterEndpoint });
  const m = useWebhookMutations();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WebhookEndpoint | null>(null);
  const [secretReveal, setSecretReveal] = useState<{ secret: string; nome: string } | null>(null);

  return (
    <SectionShell
      title="Webhooks de saída"
      description="Endpoints HTTPS que recebem eventos do ERP em tempo real (NF emitida, orçamento aprovado, etc.)."
    >
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Endpoints ativos" value={metrics.data?.endpoints_ativos ?? 0} icon={Plug} loading={metrics.isLoading} />
        <KpiCard label="Pendentes" value={metrics.data?.deliveries_pendentes ?? 0} icon={Clock} loading={metrics.isLoading} tone={metrics.data && metrics.data.deliveries_pendentes > 10 ? "warning" : "default"} />
        <KpiCard label="Falhas (24h)" value={metrics.data?.falhas_24h ?? 0} icon={XCircle} loading={metrics.isLoading} tone={metrics.data && metrics.data.falhas_24h > 0 ? "danger" : "default"} />
        <KpiCard label="Fila pgmq" value={metrics.data?.fila_total ?? 0} icon={RefreshCw} loading={metrics.isLoading} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">Endpoints configurados</CardTitle>
            <CardDescription>HTTPS recebem POST com header <code className="text-xs">X-AviZee-Signature</code> (HMAC SHA-256).</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => m.dispatch.mutate()} disabled={m.dispatch.isPending}>
              {m.dispatch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Disparar agora</span>
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Novo endpoint</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {endpoints.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : endpoints.data && endpoints.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Eventos</TableHead>
                    <TableHead className="text-right">Sucesso/Falha</TableHead>
                    <TableHead>Último</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.data.map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={ep.ativo}
                            onCheckedChange={(v) => m.update.mutate({ id: ep.id, patch: { ativo: v } })}
                            aria-label={`${ep.ativo ? "Desativar" : "Ativar"} ${ep.nome}`}
                          />
                          <button className="text-left hover:underline" onClick={() => setEditing(ep)}>
                            <div className="font-medium text-sm">{ep.nome}</div>
                            {ep.descricao && <div className="text-xs text-muted-foreground">{ep.descricao}</div>}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate" title={ep.url}>{ep.url}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {ep.eventos.slice(0, 3).map((e) => (
                            <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                          ))}
                          {ep.eventos.length > 3 && <Badge variant="outline" className="text-[10px]">+{ep.eventos.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span className="text-green-600">{ep.total_sucesso}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-destructive">{ep.total_falha}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {statusBadge(ep.ultimo_status)}
                        <div className="text-[10px] text-muted-foreground mt-0.5">{formatRel(ep.ultimo_disparo_em)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Rotacionar segredo"
                            onClick={async () => {
                              const r = await m.rotate.mutateAsync(ep.id);
                              setSecretReveal({ secret: r.secret, nome: ep.nome });
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            title="Remover"
                            onClick={() => setConfirmDelete(ep)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum webhook configurado. Crie um para começar a receber eventos.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deliveries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Últimas entregas</CardTitle>
              <CardDescription>Histórico das últimas 100 entregas, com tentativas e código HTTP.</CardDescription>
            </div>
            {endpoints.data && endpoints.data.length > 0 && (
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={filterEndpoint ?? ""}
                onChange={(e) => setFilterEndpoint(e.target.value || undefined)}
              >
                <option value="">Todos os endpoints</option>
                {endpoints.data.map((ep) => <option key={ep.id} value={ep.id}>{ep.nome}</option>)}
              </select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {deliveries.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : deliveries.data && deliveries.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">HTTP</TableHead>
                    <TableHead className="text-right">Tentativas</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{formatRel(d.enfileirado_em)}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{d.evento}</Badge></TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-right text-xs">{d.http_status ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">{d.tentativas}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={d.ultimo_erro ?? undefined}>
                        {d.ultimo_erro ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(d.status === "falha" || d.status === "cancelado") ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Reenfileirar entrega"
                            disabled={m.replay.isPending}
                            onClick={() => m.replay.mutate(d.id)}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">Nenhuma entrega registrada ainda.</div>
          )}
        </CardContent>
      </Card>

      <EndpointDialog
        open={createOpen || !!editing}
        endpoint={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onCreate={async (input) => {
          const r = await m.create.mutateAsync(input);
          setCreateOpen(false);
          setSecretReveal({ secret: r.secret, nome: input.nome });
        }}
        onUpdate={async (id, patch) => {
          await m.update.mutateAsync({ id, patch });
          setEditing(null);
        }}
      />

      <SecretRevealDialog reveal={secretReveal} onClose={() => setSecretReveal(null)} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              O endpoint <strong>{confirmDelete?.nome}</strong> deixará de receber eventos imediatamente.
              O histórico de entregas também será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) m.remove.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}

function KpiCard({ label, value, icon: Icon, loading, tone = "default" }: { label: string; value: number; icon: typeof Plug; loading?: boolean; tone?: "default" | "warning" | "danger" }) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? <Skeleton className="h-7 w-12 mt-1" /> : <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function EndpointDialog({
  open, endpoint, onClose, onCreate, onUpdate,
}: {
  open: boolean;
  endpoint: WebhookEndpoint | null;
  onClose: () => void;
  onCreate: (input: { nome: string; url: string; eventos: string[]; descricao?: string | null }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<WebhookEndpoint>) => Promise<void>;
}) {
  const isEdit = !!endpoint;
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [eventos, setEventos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Sincroniza ao abrir
  useMemo(() => {
    if (open) {
      setNome(endpoint?.nome ?? "");
      setUrl(endpoint?.url ?? "");
      setDescricao(endpoint?.descricao ?? "");
      setEventos(endpoint?.eventos ?? []);
    }
  }, [open, endpoint]);

  const valid = nome.trim().length >= 2 && /^https?:\/\//i.test(url) && eventos.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar webhook" : "Novo webhook"}</DialogTitle>
          <DialogDescription>
            Configure o endpoint HTTPS que receberá os eventos. Use HMAC SHA-256 para validar a origem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="wh-nome">Nome</Label>
            <Input id="wh-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Integração ERP externo" />
          </div>
          <div>
            <Label htmlFor="wh-url">URL de destino</Label>
            <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemplo.com/webhook" />
          </div>
          <div>
            <Label htmlFor="wh-desc">Descrição (opcional)</Label>
            <Textarea id="wh-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Eventos assinados</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 max-h-48 overflow-y-auto border rounded-md p-2">
              {WEBHOOK_EVENTOS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                  <input
                    type="checkbox"
                    checked={eventos.includes(ev)}
                    onChange={(e) => setEventos((curr) => e.target.checked ? [...curr, ev] : curr.filter((x) => x !== ev))}
                  />
                  <code>{ev}</code>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                if (isEdit && endpoint) {
                  await onUpdate(endpoint.id, { nome, url, descricao: descricao || null, eventos });
                } else {
                  await onCreate({ nome, url, descricao: descricao || null, eventos });
                }
              } finally { setSubmitting(false); }
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isEdit ? "Salvar" : "Criar webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecretRevealDialog({ reveal, onClose }: { reveal: { secret: string; nome: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!reveal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segredo do webhook</DialogTitle>
          <DialogDescription>
            Copie agora — esta é a única vez que o segredo aparece em texto puro.
            Ele será usado para validar a assinatura HMAC SHA-256 nas requisições.
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Webhook: {reveal?.nome}</AlertTitle>
          <AlertDescription>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">{reveal?.secret}</code>
              <Button
                size="sm" variant="outline"
                onClick={() => {
                  if (reveal) {
                    navigator.clipboard.writeText(reveal.secret);
                    toast.success("Segredo copiado.");
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={onClose}>Entendi, fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
