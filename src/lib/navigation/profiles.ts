/**
 * Perfis operacionais (modo de visão) do menu mobile.
 *
 * Permissão (`useCan`) é a única fonte de autorização. O perfil apenas REORDENA
 * e RECOLHE seções menos relevantes em "Outros módulos" — nunca expõe acesso
 * que o usuário não tenha por papel/permissão.
 */

import type { NavSectionKey } from '@/lib/navigation';

export const NAV_PROFILES = [
  'completo',
  'comercial',
  'financeiro',
  'fiscal',
  'logistica',
  'compras',
  'diretoria',
] as const;

export type NavProfile = (typeof NAV_PROFILES)[number];

export const NAV_PROFILE_LABELS: Record<NavProfile, string> = {
  completo: 'Completo',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  logistica: 'Logística',
  compras: 'Compras',
  diretoria: 'Diretoria',
};

export const NAV_PROFILE_DESCRIPTIONS: Record<NavProfile, string> = {
  completo: 'Mostra todos os módulos disponíveis',
  comercial: 'Foca em orçamentos, pedidos e clientes',
  financeiro: 'Foca em lançamentos, fluxo e conciliação',
  fiscal: 'Foca em emissão e consulta de notas',
  logistica: 'Foca em estoque, remessas e transporte',
  compras: 'Foca em cotações e pedidos de compra',
  diretoria: 'Visão executiva: relatórios, financeiro, fiscal',
};

/**
 * Seções priorizadas por perfil. As demais visíveis ainda aparecem,
 * mas agrupadas em "Outros módulos" no final do menu.
 */
export const PROFILE_SECTION_KEYS: Record<NavProfile, NavSectionKey[]> = {
  completo: [],
  comercial: ['comercial', 'cadastros', 'fiscal'],
  financeiro: ['financeiro', 'relatorios', 'cadastros'],
  fiscal: ['fiscal', 'cadastros', 'financeiro'],
  logistica: ['estoque', 'cadastros', 'comercial'],
  compras: ['comercial', 'cadastros', 'estoque'],
  diretoria: ['relatorios', 'financeiro', 'fiscal', 'comercial'],
};

export function isPriorityProfile(profile: NavProfile): boolean {
  return profile !== 'completo';
}