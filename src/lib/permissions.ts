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
] as const;

export type ErpResource = (typeof ERP_RESOURCES)[number];
export type ErpAction = (typeof ERP_ACTIONS)[number];

export type PermissionKey = `${ErpResource}:${ErpAction}`;

const rolePermissionMatrix: Record<AppRole, PermissionKey[]> = {
  admin: ERP_RESOURCES.flatMap((resource) => [
    `${resource}:visualizar` as PermissionKey,
    `${resource}:editar` as PermissionKey,
  ]),
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

export function getRolePermissions(role: AppRole): PermissionKey[] {
  return rolePermissionMatrix[role] || [];
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
