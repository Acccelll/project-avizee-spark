/**
 * PermissaoMatrix — Tabela visual de permissões por perfil (CATÁLOGO READ-ONLY).
 *
 * A matriz é a fonte canônica de permissões padrão por papel — definida em
 * código (`src/lib/permissions.ts`). Overrides individuais (allow/deny) são
 * gerenciados via `admin-users` no cadastro de usuários.
 */

import { Fragment, useMemo, useState } from "react";
import { ExternalLink, Info, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ERP_RESOURCES,
  getRolePermissions,
  humanizeResource,
  humanizeAction,
  ROLE_LABELS,
  PERMISSION_HELP_TEXT,
  type ErpResource,
  type ErpAction,
  type PermissionKey,
} from "@/lib/permissions";
import type { AppRole } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const ALL_ROLES: AppRole[] = ["admin", "vendedor", "financeiro", "estoquista"];

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

/** Ações nucleares — sempre exibidas. */
const CORE_ACTIONS: ErpAction[] = ["visualizar", "criar", "editar", "excluir", "exportar", "aprovar", "cancelar"];
/** Ações avançadas — exibidas via toggle. */
const ADVANCED_ACTIONS: ErpAction[] = [
  "confirmar", "importar_xml", "admin_fiscal", "gerar", "download",
  "editar_comentarios", "gerenciar_templates", "configurar", "sincronizar",
  "gerenciar_alertas", "baixar", "reenviar_email", "visualizar_rentabilidade",
];

type PermMatrix = Record<AppRole, Set<PermissionKey>>;

function buildMatrix(): PermMatrix {
  const matrix = {} as PermMatrix;
  for (const role of ALL_ROLES) {
    matrix[role] = new Set(getRolePermissions(role));
  }
  return matrix;
}

export function PermissaoMatrix() {
  const matrix = useMemo(buildMatrix, []);
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const matrixActions = useMemo<ErpAction[]>(
    () => (showAdvanced ? [...CORE_ACTIONS, ...ADVANCED_ACTIONS] : CORE_ACTIONS),
    [showAdvanced]
  );

  /** Para cada ação, verifica se algum role/recurso a usa — esconde colunas vazias. */
  const visibleActions = useMemo<ErpAction[]>(() => {
    return matrixActions.filter((action) =>
      ALL_ROLES.some((role) =>
        ERP_RESOURCES.some((res) => matrix[role].has(`${res}:${action}` as PermissionKey))
      )
    );
  }, [matrix, matrixActions]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return MODULE_GROUPS;
    return MODULE_GROUPS.map((g) => ({
      ...g,
      resources: g.resources.filter((r) =>
        humanizeResource(r).toLowerCase().includes(term) ||
        r.toLowerCase().includes(term) ||
        g.label.toLowerCase().includes(term),
      ),
    })).filter((g) => g.resources.length > 0);
  }, [search]);

  const totals = useMemo(() => {
    const out = {} as Record<AppRole, number>;
    for (const role of ALL_ROLES) out[role] = matrix[role].size;
    return out;
  }, [matrix]);

  const allResources = ERP_RESOURCES.length;
  const totalCells = allResources * visibleActions.length;
  const totalActionsCount = CORE_ACTIONS.length + ADVANCED_ACTIONS.length;
  const matrixCoverage = Math.round((visibleActions.length / totalActionsCount) * 100);

  return (
    <div className="space-y-4">
      {/* Banner colapsável */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
            <Info className="h-3.5 w-3.5" />
            <span>Sobre esta matriz (somente leitura)</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-md border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            Esta matriz é a <strong>fonte canônica</strong> de permissões padrão por perfil — definida em código (
            <span className="font-mono text-[11px]">src/lib/permissions.ts</span>). Para conceder ou{" "}
            <strong>revogar</strong> permissões a um usuário específico (override individual), use o cadastro de
            usuários — o sistema honra <span className="font-mono text-[11px]">user_permissions.allowed=false</span>{" "}
            para remover permissões herdadas do papel.
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Header + busca + toggle avançado */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Matriz de Permissões</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permissões padrão por perfil. Exibindo {visibleActions.length} de {totalActionsCount} ações disponíveis.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cobertura desta visualização: <strong>{matrixCoverage}%</strong>. {PERMISSION_HELP_TEXT.matrizCatalogo}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="matrix-advanced"
              checked={showAdvanced}
              onCheckedChange={setShowAdvanced}
            />
            <Label htmlFor="matrix-advanced" className="text-xs cursor-pointer">
              Ações avançadas
            </Label>
          </div>
          <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar recurso ou módulo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 pr-8 text-sm"
          />
          {search && (
                <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">Permissão</TableHead>
              {visibleActions.map((action) => (
                <TableHead key={action} className="text-center text-xs whitespace-nowrap px-2">
                  {humanizeAction(action)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredGroups.length === 0 && (
              <TableRow>
                <TableCell colSpan={1 + visibleActions.length} className="text-center text-xs text-muted-foreground py-8">
                  Nenhum recurso encontrado para "{search}".
                </TableCell>
              </TableRow>
            )}
            {filteredGroups.map((group) => (
              <Fragment key={`fragment-${group.label}`}>
                <TableRow key={`group-${group.label}`} className="bg-muted/30">
                  <TableCell
                    colSpan={1 + visibleActions.length}
                    className="py-1.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0"
                  >
                    {group.label}
                  </TableCell>
                </TableRow>

                {group.resources.map((resource) =>
                  ALL_ROLES.map((role, roleIdx) => {
                    const isAdmin = role === "admin";
                    return (
                      <TableRow key={`${resource}-${role}`} className={roleIdx === 0 ? "border-t" : ""}>
                        <TableCell className="sticky left-0 bg-background z-10 py-1.5 pl-4 pr-2">
                          {roleIdx === 0 ? (
                            <span className="text-sm font-medium">{humanizeResource(resource)}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground block">{ROLE_LABELS[role]}</span>
                        </TableCell>
                        {visibleActions.map((action) => {
                          const key = `${resource}:${action}` as PermissionKey;
                          const checked = matrix[role].has(key);
                          return (
                            <TableCell key={action} className="text-center px-2 py-1">
                              <Checkbox
                                checked={checked}
                                disabled
                                className={cn(isAdmin && "opacity-60")}
                                aria-label={`${ROLE_LABELS[role]}: ${humanizeResource(resource)} ${humanizeAction(action)}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer — resumo + legenda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-3">
          {ALL_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{ROLE_LABELS[role]}:</span>
              <span>{totals[role]} de {totalCells} permissões</span>
            </div>
          ))}
        </div>
        <p className="italic">
          Visualização do catálogo padrão. Overrides individuais são geridos no cadastro de usuários.
        </p>
      </div>
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="/administracao?tab=usuarios">
            Abrir gestão de usuários e overrides
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
