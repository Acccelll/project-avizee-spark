/**
 * EmpresasSection — admin do multi-tenant (Onda 1).
 *
 * Permite listar/criar/editar/inativar empresas e gerenciar o vínculo
 * 1:1 user → empresa (`user_empresas`). Hoje é a única superfície
 * gráfica para essas operações; antes só dava para fazer via SQL.
 *
 * Admin-only via RLS server-side; o gate visual fica em
 * `Administracao.tsx` (que só lista a aba para `useIsAdmin`).
 */

import { useMemo, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2, UserPlus, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import {
  useEmpresaBindings,
  useEmpresasList,
  useEmpresasMutations,
  useUnboundUsers,
} from "@/pages/admin/hooks/useEmpresasAdmin";
import type { Empresa } from "@/services/empresas.service";

export function EmpresasSection() {
  const empresasQ = useEmpresasList();
  const bindingsQ = useEmpresaBindings();
  const unboundQ = useUnboundUsers();
  const mut = useEmpresasMutations();

  const [editing, setEditing] = useState<Empresa | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Empresa | null>(null);

  const empresas = empresasQ.data ?? [];
  const bindings = bindingsQ.data ?? [];
  const unbound = unboundQ.data ?? [];

  const empresaUserCount = useMemo(() => {
    const m = new Map<string, number>();
    bindings.forEach((b) => m.set(b.empresa_id, (m.get(b.empresa_id) ?? 0) + 1));
    return m;
  }, [bindings]);

  return (
    <SectionShell
      title="Empresas e vínculos"
      description="Gestão das empresas (tenants) do sistema e do vínculo 1:1 entre usuários e empresas."
    >
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Empresas" value={empresas.length} icon={Building2} />
        <KpiCard title="Usuários vinculados" value={bindings.length} icon={Users2} />
        <KpiCard
          title="Sem vínculo"
          value={unbound.length}
          icon={UserPlus}
          tone={unbound.length > 0 ? "warn" : "ok"}
        />
      </div>

      {unbound.length > 0 && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTitle>Usuários sem empresa</AlertTitle>
          <AlertDescription>
            Há {unbound.length} usuário(s) ativos sem vínculo. Eles não conseguem ler nem
            criar registros nos cadastros (clientes, fornecedores, produtos) até serem vinculados.
          </AlertDescription>
        </Alert>
      )}

      {/* Empresas */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Empresas</CardTitle>
            <CardDescription>
              Cada empresa é um tenant. Inativar não remove dados — apenas bloqueia novos
              vínculos. A remoção só é permitida quando não houver usuários ou cadastros
              vinculados.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        </CardHeader>
        <CardContent>
          {empresasQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : empresas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{e.cnpj ?? "—"}</TableCell>
                      <TableCell>
                        {e.ativo ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativa</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">Inativa</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {empresaUserCount.get(e.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${e.nome}`}
                            onClick={() => setEditing(e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover ${e.nome}`}
                            onClick={() => setConfirmDelete(e)}
                            disabled={(empresaUserCount.get(e.id) ?? 0) > 0}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vínculos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vínculos usuário → empresa</CardTitle>
          <CardDescription>
            Modelo 1:1 (cada usuário pertence a exatamente uma empresa). Trocar a empresa
            de um usuário só passa a valer no próximo login dele.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bindingsQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.length === 0 && unbound.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        Nenhum usuário cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {bindings.map((b) => (
                    <TableRow key={b.user_id}>
                      <TableCell className="font-medium">{b.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{b.email ?? "—"}</TableCell>
                      <TableCell>
                        <BindingSelect
                          value={b.empresa_id}
                          empresas={empresas}
                          onChange={(empresaId) =>
                            mut.bind.mutate({ userId: b.user_id, empresaId })
                          }
                          disabled={mut.bind.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover vínculo"
                          onClick={() => mut.unbind.mutate(b.user_id)}
                          disabled={mut.unbind.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {unbound.map((u) => (
                    <TableRow key={u.user_id} className="bg-amber-500/5">
                      <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                      <TableCell>
                        <BindingSelect
                          value={undefined}
                          empresas={empresas}
                          placeholder="Selecionar empresa…"
                          onChange={(empresaId) =>
                            mut.bind.mutate({ userId: u.user_id, empresaId })
                          }
                          disabled={mut.bind.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          Sem vínculo
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: criar */}
      <EmpresaFormDialog
        open={creating}
        onOpenChange={(o) => !o && setCreating(false)}
        title="Nova empresa"
        submitting={mut.create.isPending}
        onSubmit={(values) =>
          mut.create.mutateAsync(values).then(() => setCreating(false))
        }
      />

      {/* Dialog: editar */}
      <EmpresaFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar empresa"
        initial={editing ?? undefined}
        submitting={mut.update.isPending}
        onSubmit={(values) =>
          editing
            ? mut.update
                .mutateAsync({ id: editing.id, patch: values })
                .then(() => setEditing(null))
            : Promise.resolve()
        }
      />

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto remove permanentemente <strong>{confirmDelete?.nome}</strong>. A operação
              falhará se houver usuários ou cadastros vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  mut.remove.mutate(confirmDelete.id, {
                    onSettled: () => setConfirmDelete(null),
                  });
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}

/* -------------------------------- pieces -------------------------------- */

function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: number;
  icon: typeof Building2;
  tone?: "neutral" | "ok" | "warn";
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "ok"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function BindingSelect({
  value,
  empresas,
  onChange,
  disabled,
  placeholder = "Selecionar…",
}: {
  value: string | undefined;
  empresas: Empresa[];
  onChange: (empresaId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 w-[220px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {empresas
          .filter((e) => e.ativo || e.id === value)
          .map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}
              {!e.ativo && " (inativa)"}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function EmpresaFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: Empresa;
  submitting: boolean;
  onSubmit: (values: { nome: string; cnpj: string | null; ativo?: boolean }) => Promise<unknown>;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? "");
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);

  // Reset quando abrir/fechar ou trocar a empresa em edição.
  useState(() => {
    setNome(initial?.nome ?? "");
    setCnpj(initial?.cnpj ?? "");
    setAtivo(initial?.ativo ?? true);
    return undefined;
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setNome(initial?.nome ?? "");
          setCnpj(initial?.cnpj ?? "");
          setAtivo(initial?.ativo ?? true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            O nome deve ser único. CNPJ é opcional nesta onda — fica reservado para
            integrações fiscais por empresa em ondas futuras.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="empresa-nome">Nome *</Label>
            <Input
              id="empresa-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Razão social ou nome fantasia"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="empresa-cnpj">CNPJ</Label>
            <Input
              id="empresa-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          {initial && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Empresa ativa</p>
                <p className="text-xs text-muted-foreground">
                  Inativar não remove dados; apenas oculta a empresa em novos vínculos.
                </p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!nome.trim()) return;
              onSubmit({
                nome: nome.trim(),
                cnpj: cnpj.trim() || null,
                ...(initial ? { ativo } : {}),
              });
            }}
            disabled={submitting || !nome.trim()}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}