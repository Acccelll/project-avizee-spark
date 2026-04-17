/**
 * PermissaoMatrix — Tabela visual de permissões por perfil (CATÁLOGO READ-ONLY).
 *
 * Exibe linhas agrupadas por módulo (recursos ERP) e colunas por perfil de
 * acesso (app_role). Os checkboxes são apenas visuais — indicam as permissões
 * padrão definidas em `src/lib/permissions.ts`.
 *
 * NOTA ARQUITETURAL: Esta matriz é um catálogo visual estático. A persistência
 * de permissões globais por perfil exigiria uma migration que ainda não existe.
 * Permissões individuais de usuário são gerenciadas via `admin-users` (edge fn).
 * O botão de salvar foi removido para evitar gravações incompletas sem user_id.
 */

import { useMemo } from "react";
import { Info } from "lucide-react";
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

function buildMatrix(): PermMatrix {
  const matrix = {} as PermMatrix;
  for (const role of ALL_ROLES) {
    matrix[role] = new Set(getRolePermissions(role));
  }
  return matrix;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PermissaoMatrix() {
  // Read-only matrix derived from static role definitions in permissions.ts
  const matrix = useMemo(buildMatrix, []);

  return (
    <div className="space-y-4">
      {/* Banner informativo */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Esta matriz é um <strong>catálogo visual de permissões padrão por perfil</strong>.
          As permissões globais por perfil são definidas em código ({" "}
          <span className="font-mono text-xs">src/lib/permissions.ts</span>). Para conceder
          permissões individuais a um usuário específico, use o cadastro de usuários.
        </p>
      </div>

      {/* Cabeçalho */}
      <div>
        <h3 className="text-sm font-semibold">Matriz de Permissões</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Permissões padrão por perfil de acesso. Checkboxes marcados indicam permissão concedida pelo perfil.
        </p>
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

                {/* Linhas por recurso × perfil */}
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
                          return (
                            <TableCell key={action} className="text-center px-2 py-1">
                              <Checkbox
                                checked={checked}
                                disabled
                                className={isAdmin ? "opacity-60" : undefined}
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
        * O perfil <strong>Administrador</strong> possui acesso total. As permissões exibidas
        refletem as definições estáticas em <span className="font-mono">src/lib/permissions.ts</span>.
      </p>
    </div>
  );
}
