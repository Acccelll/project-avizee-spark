/**
 * Tipos, helpers e constantes compartilhadas pelos subcomponentes do
 * módulo de Usuários. Extraídos de `UsuariosTab.tsx` na Fase 6 para
 * reduzir o god-component a um orquestrador.
 *
 * Nada aqui é exportado fora do diretório `components/usuarios/` —
 * o ponto público continua sendo `UsuariosTab`.
 */

import { supabase } from '@/integrations/supabase/client';
import { RESOURCE_LABELS, type ErpResource } from '@/lib/permissions';
import type { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

export const ALL_ROLES: AppRole[] = [
  'admin',
  'vendedor',
  'financeiro',
  'estoquista',
  'gestor_compras',
  'operador_logistico',
];

export const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/30',
  vendedor: 'bg-primary/10 text-primary border-primary/30',
  financeiro: 'bg-warning/10 text-warning border-warning/30',
  estoquista: 'bg-success/10 text-success border-success/30',
  gestor_compras: 'bg-secondary/15 text-secondary border-secondary/30',
  operador_logistico: 'bg-info/10 text-info border-info/30',
  user: 'bg-muted text-muted-foreground border-muted-foreground/30',
  viewer: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

/**
 * Rótulos hierárquicos para o editor — exibe "Cadastros › Produtos" no lugar
 * do label flat de `RESOURCE_LABELS`. Usado SOMENTE no editor de permissões
 * (a fonte canônica `RESOURCE_LABELS` em `lib/permissions.ts` continua sendo
 * o padrão para o resto da aplicação: AccessDenied, tooltips, catálogo, etc.).
 */
export const RESOURCE_PATH_LABEL: Partial<Record<ErpResource, string>> = {
  produtos: 'Cadastros › Produtos',
  clientes: 'Cadastros › Clientes',
  fornecedores: 'Cadastros › Fornecedores',
  transportadoras: 'Cadastros › Transportadoras',
  formas_pagamento: 'Cadastros › Formas de pagamento',
  orcamentos: 'Comercial › Orçamentos',
  pedidos: 'Comercial › Pedidos',
  compras: 'Compras › Pedidos de compra',
  financeiro: 'Financeiro › Lançamentos',
  faturamento_fiscal: 'Fiscal › Notas',
  usuarios: 'Administração › Usuários',
  socios: 'Sócios e participações',
};

export const resourceLabel = (r: ErpResource) =>
  RESOURCE_PATH_LABEL[r] ?? RESOURCE_LABELS[r];

export interface UserWithRoles {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  role_padrao: AppRole;
  /**
   * Roles secundários cumulativos (não inclui o `role_padrao`).
   * As permissões finais do usuário são a UNIÃO das permissões herdadas de
   * todos os roles (padrão + secundários) somadas aos overrides individuais.
   * O role padrão é mantido por separado apenas para auditoria/UI — funcionalmente
   * o efeito é o mesmo de incluí-lo na lista de roles.
   */
  roles_secundarios: AppRole[];
  extra_permissions: string[];
  /** Revogações individuais (`user_permissions.allowed=false`). */
  denied_permissions: string[];
  /** Não persistido — usado para exibição. */
  last_sign_in?: string | null;
}

export interface UserFormData {
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
  role_padrao: AppRole;
  roles_secundarios: AppRole[];
  extra_permissions: string[];
  denied_permissions: string[];
}

export const emptyForm = (): UserFormData => ({
  nome: '',
  email: '',
  cargo: '',
  ativo: true,
  role_padrao: 'vendedor',
  roles_secundarios: [],
  extra_permissions: [],
  denied_permissions: [],
});

export const ADMIN_USERS_FUNCTION = 'admin-users';

/**
 * Wrapper único para invocar a edge function `admin-users`. Centralizar aqui
 * mantém o tratamento de erro consistente (tanto erro HTTP quanto payload
 * `{ error: '...' }` retornado pela função).
 */
export async function invokeAdminUsers(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(ADMIN_USERS_FUNCTION, {
    body: payload,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}