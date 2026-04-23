/**
 * Metadados de auditoria — fonte única para mapear nomes técnicos
 * (tabela / tipo de ação) em rótulos legíveis e visuais.
 *
 * Antes vivia duplicado em `src/pages/Auditoria.tsx` e `src/pages/admin/Logs.tsx`.
 * Centralizado para suportar a view `v_admin_audit_unified`, que mistura
 * eventos de `auditoria_logs` (INSERT/UPDATE/DELETE em tabelas de domínio)
 * com eventos de `permission_audit` (role/permission/config/branding/self).
 */

import { Edit, Plus, Shield, Trash2, KeyRound, UserCog, Settings, Image, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ─── Tabela / Entidade → módulo + entidade humanizados ──────────────── */

export interface TableMeta {
  modulo: string;
  entidade: string;
}

const TABLE_META: Record<string, TableMeta> = {
  // Financeiro
  financeiro_lancamentos: { modulo: "Financeiro", entidade: "Lançamentos" },
  financeiro_baixas: { modulo: "Financeiro", entidade: "Baixas" },
  contas_bancarias: { modulo: "Financeiro", entidade: "Contas Bancárias" },
  contas_contabeis: { modulo: "Financeiro", entidade: "Contas Contábeis" },
  formas_pagamento: { modulo: "Financeiro", entidade: "Formas de Pagamento" },
  caixa_movimentos: { modulo: "Caixa", entidade: "Movimentos de Caixa" },
  // Fiscal
  notas_fiscais: { modulo: "Fiscal", entidade: "Notas Fiscais" },
  notas_fiscais_itens: { modulo: "Fiscal", entidade: "Itens de NF" },
  // Vendas
  orcamentos: { modulo: "Vendas", entidade: "Orçamentos" },
  orcamentos_itens: { modulo: "Vendas", entidade: "Itens de Orçamento" },
  ordens_venda: { modulo: "Vendas", entidade: "Ordens de Venda" },
  ordens_venda_itens: { modulo: "Vendas", entidade: "Itens de OV" },
  // Compras
  pedidos_compra: { modulo: "Compras", entidade: "Pedidos de Compra" },
  pedidos_compra_itens: { modulo: "Compras", entidade: "Itens de Pedido" },
  cotacoes_compra: { modulo: "Compras", entidade: "Cotações" },
  cotacoes_compra_itens: { modulo: "Compras", entidade: "Itens de Cotação" },
  cotacoes_compra_propostas: { modulo: "Compras", entidade: "Propostas" },
  compras: { modulo: "Compras", entidade: "Compras" },
  compras_itens: { modulo: "Compras", entidade: "Itens de Compra" },
  // Estoque / Produtos
  produtos: { modulo: "Estoque", entidade: "Produtos" },
  grupos_produto: { modulo: "Estoque", entidade: "Grupos de Produto" },
  produto_composicoes: { modulo: "Estoque", entidade: "Composições" },
  produtos_fornecedores: { modulo: "Estoque", entidade: "Fornecedores do Produto" },
  precos_especiais: { modulo: "Preços", entidade: "Preços Especiais" },
  // Clientes / Fornecedores
  clientes: { modulo: "Clientes", entidade: "Clientes" },
  cliente_registros_comunicacao: { modulo: "Clientes", entidade: "Comunicações" },
  cliente_transportadoras: { modulo: "Clientes", entidade: "Transportadoras do Cliente" },
  fornecedores: { modulo: "Fornecedores", entidade: "Fornecedores" },
  grupos_economicos: { modulo: "Clientes", entidade: "Grupos Econômicos" },
  // Logística
  remessas: { modulo: "Logística", entidade: "Remessas" },
  remessa_eventos: { modulo: "Logística", entidade: "Eventos de Remessa" },
  transportadoras: { modulo: "Logística", entidade: "Transportadoras" },
  // RH
  funcionarios: { modulo: "RH", entidade: "Funcionários" },
  folha_pagamento: { modulo: "RH", entidade: "Folha de Pagamento" },
  // Administração
  profiles: { modulo: "Administração", entidade: "Usuários" },
  user_roles: { modulo: "Administração", entidade: "Papéis de Acesso" },
  user_permissions: { modulo: "Administração", entidade: "Permissões Individuais" },
  empresa_config: { modulo: "Administração", entidade: "Configurações da Empresa" },
  app_configuracoes: { modulo: "Administração", entidade: "Configurações do Sistema" },
  bancos: { modulo: "Administração", entidade: "Bancos" },
  // Importação
  importacao_logs: { modulo: "Importação", entidade: "Logs de Importação" },
  importacao_lotes: { modulo: "Importação", entidade: "Lotes de Importação" },
};

export function getTableMeta(tabela: string | null | undefined): TableMeta {
  if (!tabela) return { modulo: "Sistema", entidade: "—" };
  return TABLE_META[tabela] ?? { modulo: "Sistema", entidade: tabela };
}

/** Lista das entidades conhecidas (para popular Selects). */
export const KNOWN_TABLES = Object.keys(TABLE_META).sort();

/* ─── Tipo de ação → rótulo, ícone, variante semântica ──────────────── */

export type ActionVariant = "success" | "info" | "destructive" | "warning" | "muted";

export interface AcaoMeta {
  label: string;
  variant: ActionVariant;
  icon: LucideIcon;
}

/**
 * Mapa de ações cobrindo as duas trilhas:
 *  - `auditoria_logs.acao`: INSERT, UPDATE, DELETE.
 *  - `permission_audit.tipo_acao`: role_*, permission_*, config_*, branding_*,
 *    logo_upload, self_profile_update, etc.
 */
const ACAO_META: Record<string, AcaoMeta> = {
  // CRUD operacional
  INSERT: { label: "Criação", variant: "success", icon: Plus },
  UPDATE: { label: "Edição", variant: "info", icon: Edit },
  DELETE: { label: "Exclusão", variant: "destructive", icon: Trash2 },
  // Governança — papéis
  role_grant: { label: "Papel concedido", variant: "warning", icon: UserCog },
  role_revoke: { label: "Papel revogado", variant: "destructive", icon: UserCog },
  role_update: { label: "Papel atualizado", variant: "warning", icon: UserCog },
  // Governança — permissões individuais
  permission_grant: { label: "Permissão concedida", variant: "warning", icon: KeyRound },
  permission_revoke: { label: "Permissão revogada", variant: "destructive", icon: KeyRound },
  permission_update: { label: "Permissão atualizada", variant: "warning", icon: KeyRound },
  // Configuração
  config_update: { label: "Configuração alterada", variant: "warning", icon: Settings },
  branding_update: { label: "Marca alterada", variant: "info", icon: Image },
  logo_upload: { label: "Logo enviado", variant: "info", icon: Image },
  // Perfil próprio
  self_profile_update: { label: "Perfil próprio atualizado", variant: "muted", icon: UserCircle },
};

export function getAcaoMeta(acao: string | null | undefined): AcaoMeta {
  if (!acao) return { label: "—", variant: "muted", icon: Shield };
  return ACAO_META[acao] ?? { label: acao, variant: "muted", icon: Shield };
}

/** Lista de ações conhecidas para popular Select. */
export const KNOWN_ACOES: { value: string; label: string }[] = Object.entries(
  ACAO_META,
).map(([value, meta]) => ({ value, label: meta.label }));

/* ─── Criticidade ────────────────────────────────────────────────────── */

export type Criticality = "alta" | "media" | "baixa";

const SENSITIVE_TABLES = new Set([
  "profiles",
  "user_roles",
  "user_permissions",
  "empresa_config",
  "app_configuracoes",
  "notas_fiscais",
  "financeiro_lancamentos",
  "financeiro_baixas",
]);

const HIGH_CRIT_ACOES = new Set([
  "DELETE",
  "role_grant",
  "role_revoke",
  "role_update",
  "permission_grant",
  "permission_revoke",
  "permission_update",
]);

const MEDIUM_CRIT_ACOES = new Set([
  "UPDATE",
  "config_update",
  "branding_update",
  "logo_upload",
]);

export function getCriticality(args: {
  acao: string | null | undefined;
  entidade: string | null | undefined;
}): Criticality {
  const { acao, entidade } = args;
  if (acao && HIGH_CRIT_ACOES.has(acao)) return "alta";
  if (entidade && SENSITIVE_TABLES.has(entidade)) return "alta";
  if (acao && MEDIUM_CRIT_ACOES.has(acao)) return "media";
  return "baixa";
}

export interface CriticalityStyle {
  label: string;
  variant: ActionVariant;
}

export const CRITICALITY_STYLE: Record<Criticality, CriticalityStyle> = {
  alta: { label: "Alta", variant: "destructive" },
  media: { label: "Média", variant: "warning" },
  baixa: { label: "Baixa", variant: "success" },
};

/* ─── User-Agent: extração simples para "Chrome / macOS" ─────────────── */

export function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "—";
  const browserMatch =
    /(Edg|OPR|Chrome|Firefox|Safari)\/(\d+)/.exec(ua);
  const osMatch =
    /(Windows NT [\d.]+|Mac OS X [\d_.]+|Android [\d.]+|iPhone OS [\d_]+|Linux)/.exec(ua);
  const browser = browserMatch
    ? `${browserMatch[1] === "Edg" ? "Edge" : browserMatch[1]} ${browserMatch[2]}`
    : "Navegador";
  const os = osMatch
    ? osMatch[1]
        .replace("Mac OS X ", "macOS ")
        .replace("Windows NT ", "Windows ")
        .replace(/_/g, ".")
    : "SO desconhecido";
  return `${browser} · ${os}`;
}
