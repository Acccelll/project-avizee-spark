import type { AppRole } from "@/contexts/AuthContext";

export const ERP_RESOURCES = [
  "dashboard",
  "produtos",
  "clientes",
  "fornecedores",
  "transportadoras",
  "formas_pagamento",
  "orcamentos",
  "pedidos",
  "compras",
  "estoque",
  "logistica",
  "financeiro",
  "faturamento_fiscal",
  "relatorios",
  "workbook",
  "apresentacao",
  "usuarios",
  "administracao",
] as const;

export const ERP_ACTIONS = [
  "visualizar",
  "criar",
  "editar",
  "excluir",
  "aprovar",
  "cancelar",
  "baixar",
  "exportar",
  "confirmar",
  "importar_xml",
  "reenviar_email",
  "admin_fiscal",
  "gerar",
  "download",
  "editar_comentarios",
  "gerenciar_templates",
] as const;

export type ErpResource = (typeof ERP_RESOURCES)[number];
export type ErpAction = (typeof ERP_ACTIONS)[number];

export type PermissionKey = `${ErpResource}:${ErpAction}`;

/** Centralised role labels. Use this instead of defining locally in each component. */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
  estoquista: "Estoquista",
};

/** Centralised role descriptions. Use this instead of defining locally in each component. */
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Acesso total ao sistema. Gerencia usuários, configurações e todos os módulos.",
  vendedor: "Acesso a clientes, orçamentos, pedidos e logística.",
  financeiro: "Acesso ao módulo financeiro, compras, faturamento e relatórios.",
  estoquista: "Acesso a produtos, estoque, compras e logística.",
};

const rolePermissionMatrix: Record<AppRole, PermissionKey[]> = {
  admin: ERP_RESOURCES.flatMap((resource) =>
    ERP_ACTIONS.map((action) => `${resource}:${action}` as PermissionKey)
  ),
  vendedor: [
    "dashboard:visualizar",
    "clientes:visualizar",
    "clientes:editar",
    "orcamentos:visualizar",
    "orcamentos:editar",
    "pedidos:visualizar",
    "pedidos:editar",
    "logistica:visualizar",
    "relatorios:visualizar",
  ],
  financeiro: [
    "dashboard:visualizar",
    "financeiro:visualizar",
    "financeiro:editar",
    "compras:visualizar",
    "faturamento_fiscal:visualizar",
    "relatorios:visualizar",
    "workbook:visualizar",
    "workbook:exportar",
    "apresentacao:visualizar",
    "apresentacao:gerar",
    "apresentacao:editar_comentarios",
    "apresentacao:download",
    "apresentacao:aprovar",
  ],
  estoquista: [
    "dashboard:visualizar",
    "produtos:visualizar",
    "estoque:visualizar",
    "estoque:editar",
    "compras:visualizar",
    "logistica:visualizar",
    "logistica:editar",
  ],
};

/**
 * Returns the list of PermissionKeys for a given role.
 * Accepts a string to gracefully handle legacy roles (e.g. "user", "viewer")
 * that exist in the DB but are not issued to new users — returns [] for those.
 */
export function getRolePermissions(role: string): PermissionKey[] {
  return rolePermissionMatrix[role as AppRole] || [];
}

export function buildPermissionSet(roles: AppRole[], extraPermissions: PermissionKey[] = []): Set<PermissionKey> {
  const merged = new Set<PermissionKey>();
  roles.forEach((role) => getRolePermissions(role).forEach((permission) => merged.add(permission)));
  extraPermissions.forEach((permission) => merged.add(permission));
  return merged;
}

export function toPermissionKey(resource: ErpResource, action: ErpAction): PermissionKey {
  return `${resource}:${action}`;
}
