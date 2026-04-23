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
  "socios",
  "auditoria",
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

/** Rótulos humanizados para recursos ERP — uso em UI (AccessDenied, tooltips, modais). */
export const RESOURCE_LABELS: Record<ErpResource, string> = {
  dashboard: "Dashboard",
  produtos: "Produtos",
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  transportadoras: "Transportadoras",
  formas_pagamento: "Formas de pagamento",
  orcamentos: "Orçamentos",
  pedidos: "Pedidos",
  compras: "Compras",
  estoque: "Estoque",
  logistica: "Logística",
  financeiro: "Financeiro",
  faturamento_fiscal: "Faturamento fiscal",
  relatorios: "Relatórios",
  workbook: "Workbook gerencial",
  apresentacao: "Apresentação gerencial",
  social: "Social",
  usuarios: "Usuários",
  administracao: "Administração",
  socios: "Sócios e Participações",
  auditoria: "Auditoria",
};

/** Rótulos humanizados para ações ERP — uso em tooltips de botões bloqueados. */
export const ACTION_LABELS: Record<ErpAction, string> = {
  visualizar: "Visualizar",
  visualizar_rentabilidade: "Visualizar rentabilidade",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  aprovar: "Aprovar",
  cancelar: "Cancelar",
  baixar: "Baixar",
  exportar: "Exportar",
  confirmar: "Confirmar",
  importar_xml: "Importar XML",
  reenviar_email: "Reenviar e-mail",
  admin_fiscal: "Administrar fiscal",
  gerar: "Gerar",
  download: "Download",
  editar_comentarios: "Editar comentários",
  gerenciar_templates: "Gerenciar templates",
  configurar: "Configurar",
  sincronizar: "Sincronizar",
  gerenciar_alertas: "Gerenciar alertas",
};

export function humanizeResource(resource: ErpResource | string): string {
  return RESOURCE_LABELS[resource as ErpResource] ?? resource;
}

export function humanizeAction(action: ErpAction | string): string {
  return ACTION_LABELS[action as ErpAction] ?? action;
}

/** Centralised role descriptions. Use this instead of defining locally in each component. */
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Acesso total ao sistema. Gerencia usuários, configurações e todos os módulos.",
  vendedor: "Acesso a clientes, orçamentos, pedidos e logística.",
  financeiro: "Acesso ao módulo financeiro, compras, faturamento e relatórios.",
  estoquista: "Acesso a produtos, estoque, compras e logística.",
};

/** Textos de apoio padronizados para telas de governança/acesso. */
export const PERMISSION_HELP_TEXT = {
  rolePadrao:
    "Role padrão é obrigatório e define as permissões herdadas automaticamente.",
  permissaoComplementar:
    "Permissões complementares são exceções individuais adicionadas ao role padrão.",
  permissaoRevogada:
    "Permissão revogada (deny) remove acesso herdado do role padrão para um usuário específico.",
  matrizCatalogo:
    "A matriz mostra apenas o catálogo padrão por role. Overrides por usuário são gerenciados no cadastro de usuários.",
  solicitarAcesso:
    "Quando não houver acesso, solicite liberação para um administrador do sistema.",
} as const;

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
    "socios:visualizar",
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

/**
 * Mapa explícito de ações relevantes por recurso para o editor de overrides.
 *
 * Por que existe?
 *  - `ERP_ACTIONS` × `ERP_RESOURCES` = 400 combinações; muitas não fazem
 *    sentido (ex.: `produtos:importar_xml`).
 *  - A UI de overrides mostrava apenas `visualizar`/`editar` (10% do espaço
 *    real). Aqui declaramos quais ações fazem sentido para cada recurso,
 *    cobrindo exatamente o que o RBAC já reconhece nos roles padrão + ações
 *    administrativas que só admin recebe (aprovar, cancelar, admin_fiscal…).
 *
 * Mantenha em sincronia com `rolePermissionMatrix` quando uma nova ação for
 * concedida a algum role.
 */
export const RESOURCE_ACTIONS: Record<ErpResource, ErpAction[]> = {
  dashboard: ["visualizar"],
  produtos: ["visualizar", "criar", "editar", "excluir", "exportar"],
  clientes: ["visualizar", "criar", "editar", "excluir", "exportar"],
  fornecedores: ["visualizar", "criar", "editar", "excluir", "exportar"],
  transportadoras: ["visualizar", "criar", "editar", "excluir"],
  formas_pagamento: ["visualizar", "criar", "editar", "excluir"],
  orcamentos: [
    "visualizar",
    "visualizar_rentabilidade",
    "criar",
    "editar",
    "excluir",
    "aprovar",
    "cancelar",
    "exportar",
  ],
  pedidos: [
    "visualizar",
    "criar",
    "editar",
    "excluir",
    "aprovar",
    "cancelar",
    "exportar",
    "confirmar",
  ],
  compras: [
    "visualizar",
    "criar",
    "editar",
    "excluir",
    "aprovar",
    "cancelar",
    "confirmar",
  ],
  estoque: ["visualizar", "editar", "exportar", "aprovar"],
  logistica: ["visualizar", "editar", "exportar"],
  financeiro: [
    "visualizar",
    "criar",
    "editar",
    "excluir",
    "baixar",
    "aprovar",
    "cancelar",
    "exportar",
  ],
  faturamento_fiscal: [
    "visualizar",
    "criar",
    "editar",
    "excluir",
    "cancelar",
    "importar_xml",
    "reenviar_email",
    "admin_fiscal",
  ],
  relatorios: ["visualizar", "exportar"],
  workbook: ["visualizar", "gerar", "exportar", "download", "gerenciar_templates"],
  apresentacao: [
    "visualizar",
    "gerar",
    "editar_comentarios",
    "download",
    "aprovar",
    "gerenciar_templates",
  ],
  social: [
    "visualizar",
    "configurar",
    "sincronizar",
    "exportar",
    "gerenciar_alertas",
  ],
  usuarios: ["visualizar", "criar", "editar", "excluir"],
  administracao: ["visualizar", "editar", "configurar"],
  socios: ["visualizar", "editar", "exportar"],
  auditoria: ["visualizar", "exportar"],
};

/**
 * Tri-state state per (resource, action) used by the overrides editor.
 *  - `inherited`: vem do role padrão; usuário pode mantê-lo ou explicitamente
 *    revogar (`deny`). Não há "remover herança"; o que existe é o deny.
 *  - `allow`: concedido individualmente em `user_permissions(allowed=true)`.
 *  - `deny`: revogado individualmente em `user_permissions(allowed=false)` —
 *    vence a herança do papel.
 *  - `none`: não herdado e sem override.
 */
export type PermissionOverrideState = "inherited" | "allow" | "deny" | "none";
