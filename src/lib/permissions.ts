/**
 * Roles reconhecidos pela aplicação. Alinhado com o enum `app_role` do banco.
 * Definido aqui (e re-exportado em `AuthContext`) para evitar import cíclico
 * conceitual entre o contexto de auth e a matriz de permissões.
 *
 * **FONTE CANÔNICA**: A matriz `rolePermissionMatrix` abaixo é a única fonte
 * de verdade para permissões padrão por papel. A tabela `role_permissions` no
 * DB foi descontinuada (migration). Apenas `user_permissions` (overrides
 * individuais, com suporte a allowed=false para revogação) permanece no DB.
 */
export const APP_ROLES = ["admin", "vendedor", "financeiro", "estoquista"] as const;
export type AppRole = (typeof APP_ROLES)[number];

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
  "social",
  "usuarios",
  "administracao",
] as const;

export const ERP_ACTIONS = [
  "visualizar",
  "visualizar_rentabilidade",
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
  "configurar",
  "sincronizar",
  "gerenciar_alertas",
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
    "social:visualizar",
    "social:configurar",
    "social:sincronizar",
    "social:exportar",
    "social:gerenciar_alertas",
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
    "social:visualizar",
    "social:exportar",
    "orcamentos:visualizar_rentabilidade",
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

/**
 * Constrói o conjunto consolidado de permissões para um usuário.
 *
 * Precedência:
 *  1. Permissões do(s) papel(éis) (rolePermissionMatrix)
 *  2. `extraPermissions.allow` (concedidas individualmente)
 *  3. `extraPermissions.deny` (revogadas individualmente — sempre vencem)
 *
 * Aceita tanto a forma legada (array `PermissionKey[]` = só allow) quanto a
 * nova `{ allow, deny }` para suportar revogação granular via `user_permissions.allowed=false`.
 */
export function buildPermissionSet(
  roles: AppRole[],
  extraPermissions: PermissionKey[] | { allow: PermissionKey[]; deny: PermissionKey[] } = []
): Set<PermissionKey> {
  const merged = new Set<PermissionKey>();
  roles.forEach((role) => getRolePermissions(role).forEach((permission) => merged.add(permission)));

  const isShape = Array.isArray(extraPermissions);
  const allow = isShape ? extraPermissions : extraPermissions.allow;
  const deny = isShape ? [] : extraPermissions.deny;

  allow.forEach((permission) => merged.add(permission));
  deny.forEach((permission) => merged.delete(permission));

  return merged;
}

export function toPermissionKey(resource: ErpResource, action: ErpAction): PermissionKey {
  return `${resource}:${action}`;
}
