/**
 * PermissaoMatrix — Tabela visual de permissões por perfil.
 *
 * Exibe linhas agrupadas por módulo (recursos ERP) e colunas por perfil de
 * acesso (app_role). Checkboxes permitem ativar/desativar permissões; ao clicar
 * em "Salvar Alterações" a lista de mudanças é enviada ao backend via
 * `concederPermissao` / `revogarPermissao`.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ERP_RESOURCES,
  ERP_ACTIONS,
  getRolePermissions,
  type ErpResource,
  type ErpAction,
  type PermissionKey,
} from "@/lib/permissions";
import type { AppRole } from "@/contexts/AuthContext";
import { atribuirPerfil } from "@/services/admin/perfis.service";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";

// ─── Tipos ────────────────────────────────────────────────────────────────────

const ALL_ROLES: AppRole[] = ["admin", "vendedor", "financeiro", "estoquista"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
  estoquista: "Estoquista",
};

// Agrupa recursos por categoria para facilitar leitura
const MODULE_GROUPS: { label: string; resources: ErpResource[] }[] = [
  { label: "Geral", resources: ["dashboard"] },
  { label: "Comercial", resources: ["clientes", "fornecedores", "transportadoras", "orcamentos", "pedidos"] },
  { label: "Compras e Estoque", resources: ["compras", "estoque", "produtos"] },
  { label: "Financeiro", resources: ["financeiro", "formas_pagamento"] },
  { label: "Fiscal", resources: ["faturamento_fiscal"] },
  { label: "Logística", resources: ["logistica"] },
  { label: "Relatórios", resources: ["relatorios"] },
  { label: "Administração", resources: ["usuarios", "administracao"] },
];

// Ações exibidas na matriz (subset mais relevante)
const MATRIX_ACTIONS: ErpAction[] = ["visualizar", "criar", "editar", "excluir", "exportar", "aprovar"];

type PermMatrix = Record<AppRole, Set<PermissionKey>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInitialMatrix(): PermMatrix {
  const matrix = {} as PermMatrix;
  for (const role of ALL_ROLES) {
    matrix[role] = new Set(getRolePermissions(role));
  }
  return matrix;
}

type Change = { role: AppRole; key: PermissionKey; granted: boolean };

// ─── Componente ───────────────────────────────────────────────────────────────

export function PermissaoMatrix() {
  const queryClient = useQueryClient();

  // Estado local da matriz — copia mutável dos valores originais
  const [matrix, setMatrix] = useState<PermMatrix>(buildInitialMatrix);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);

  const toggle = (role: AppRole, key: PermissionKey) => {
    if (role === "admin") return; // admin tem todas as permissões — não editável

    setMatrix((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      const granted = !next[role].has(key);
      if (granted) next[role].add(key); else next[role].delete(key);
      return next;
    });

    setPendingChanges((prev) => {
      // Remove alteração anterior para esta combinação role+key (se houver)
      const filtered = prev.filter((c) => !(c.role === role && c.key === key));
      const originalHas = getRolePermissions(role).includes(key);
      const newGranted = !matrix[role].has(key); // valor pós-toggle
      if (newGranted === originalHas) {
        // Voltou ao estado original — sem mudança pendente
        return filtered;
      }
      return [...filtered, { role, key, granted: newGranted }];
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (changes: Change[]) => {
      await Promise.all(
        changes.map(async (change) => {
          const parts = change.key.split(":");
          if (parts.length !== 2) return;
          const [resource, action] = parts as [ErpResource, ErpAction];
          if (change.granted) {
            const { error } = await supabase
              .from("user_permissions")
              .upsert(
                { resource, action, allowed: true },
                { onConflict: "resource,action" }
              );
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("user_permissions")
              .delete()
              .eq("resource", resource)
              .eq("action", action);
            if (error) throw error;
          }
        })
      );
    },
    onSuccess: () => {
      setPendingChanges([]);
      toast.success("Permissões atualizadas com sucesso.");
    },
    onError: (err: Error) => {
      console.error("[PermissaoMatrix] Erro ao salvar:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  const handleSave = () => {
    if (pendingChanges.length === 0) return;
    saveMutation.mutate(pendingChanges);
  };

  const handleReset = () => {
    setMatrix(buildInitialMatrix());
    setPendingChanges([]);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Matriz de Permissões</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure as permissões por perfil de acesso. Checkboxes marcados indicam permissão concedida.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.length > 0 && (
            <Badge variant="secondary">{pendingChanges.length} alteração(ões) pendente(s)</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={pendingChanges.length === 0 || saveMutation.isPending}
            aria-label="Desfazer alterações de permissões"
          >
            Desfazer
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={pendingChanges.length === 0 || saveMutation.isPending}
            aria-label="Salvar alterações de permissões"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">Permissão</TableHead>
              {MATRIX_ACTIONS.map((action) => (
                <TableHead key={action} className="text-center capitalize text-xs whitespace-nowrap px-2">
                  {action}
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableHead className="sticky left-0 bg-muted/50 z-10 text-xs font-semibold text-muted-foreground" colSpan={1}>
                Perfil
              </TableHead>
              {MATRIX_ACTIONS.map((action) => (
                <TableHead key={action} className="px-2" />
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {MODULE_GROUPS.map((group) => (
              <>
                {/* Linha de grupo */}
                <TableRow key={`group-${group.label}`} className="bg-muted/30">
                  <TableCell
                    colSpan={1 + MATRIX_ACTIONS.length}
                    className="py-1.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0"
                  >
                    {group.label}
                  </TableCell>
                </TableRow>

                {/* Linhas por recurso × ação */}
                {group.resources.map((resource) =>
                  ALL_ROLES.map((role, roleIdx) => {
                    const isAdmin = role === "admin";
                    return (
                      <TableRow key={`${resource}-${role}`} className={roleIdx === 0 ? "border-t" : ""}>
                        <TableCell className="sticky left-0 bg-background z-10 py-1.5 pl-4 pr-2">
                          {roleIdx === 0 ? (
                            <span className="text-sm font-medium capitalize">{resource.replace(/_/g, " ")}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground block">{ROLE_LABELS[role]}</span>
                        </TableCell>
                        {MATRIX_ACTIONS.map((action) => {
                          const key: PermissionKey = `${resource}:${action}`;
                          const checked = matrix[role].has(key);
                          const changed = pendingChanges.some((c) => c.role === role && c.key === key);
                          return (
                            <TableCell key={action} className="text-center px-2 py-1">
                              <Checkbox
                                checked={checked}
                                disabled={isAdmin}
                                onCheckedChange={() => toggle(role, key)}
                                className={changed ? "ring-2 ring-primary" : undefined}
                                aria-label={`${ROLE_LABELS[role]}: ${resource} ${action}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        * O perfil <strong>Administrador</strong> possui acesso total e não pode ser editado aqui.
      </p>
    </div>
  );
}
