import type { AppRole } from '@/contexts/AuthContext';

export type SocialPlatform = 'instagram_business' | 'linkedin_page';
export type SocialConnectionStatus = 'conectado' | 'expirado' | 'erro' | 'desconectado';
export type SocialPostType = 'feed' | 'reels' | 'story' | 'video' | 'artigo' | 'carousel';
export type SocialAlertSeverity = 'baixa' | 'media' | 'alta' | 'critica';

export interface SocialConta {
  id: string;
  plataforma: SocialPlatform;
  nome_conta: string;
  identificador_externo: string;
  status_conexao: SocialConnectionStatus;
  ultima_sincronizacao: string | null;
  url_conta: string | null;
  escopos: string[];
  ativo: boolean;
  data_cadastro: string;
}

export interface SocialDashboardComparativo {
  plataforma: SocialPlatform;
  seguidores_novos: number;
  engajamento_total: number;
  taxa_engajamento_media: number;
  impressoes: number;
  alcance: number;
  quantidade_posts_periodo: number;
}

export interface SocialDashboardConsolidado {
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  comparativo: SocialDashboardComparativo[];
  totais: {
    seguidores_novos: number;
    engajamento_total: number;
    impressoes: number;
    alcance: number;
  };
}

export interface SocialMetricaSnapshot {
  id: string;
  conta_id: string;
  data_referencia: string;
  seguidores_total: number;
  seguidores_novos: number;
  impressoes: number;
  alcance: number;
  visitas_perfil: number;
  cliques_link: number;
  engajamento_total: number;
  taxa_engajamento: number;
  quantidade_posts_periodo: number;
  observacoes: string | null;
  data_cadastro: string;
}

export interface SocialPost {
  id: string;
  conta_id: string;
  plataforma: SocialPlatform;
  nome_conta: string;
  id_externo_post: string;
  data_publicacao: string;
  titulo_legenda: string | null;
  url_post: string | null;
  tipo_post: SocialPostType;
  campanha_id: string | null;
  impressoes: number;
  alcance: number;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  salvamentos: number;
  cliques: number;
  engajamento_total: number;
  taxa_engajamento: number;
  destaque: boolean;
}

export interface SocialAlerta {
  id: string;
  conta_id: string | null;
  tipo_alerta: string;
  titulo: string;
  descricao: string | null;
  severidade: SocialAlertSeverity;
  resolvido: boolean;
  data_referencia: string | null;
  data_cadastro: string;
}

export interface SocialCreateContaPayload {
  plataforma: SocialPlatform;
  nome_conta: string;
  identificador_externo: string;
  url_conta?: string | null;
  status_conexao: SocialConnectionStatus;
  escopos?: string[];
}

export interface SocialUpdateContaPayload {
  nome_conta?: string;
  identificador_externo?: string;
  url_conta?: string | null;
  status_conexao?: SocialConnectionStatus;
  escopos?: string[];
  ultima_sincronizacao?: string | null;
}

export interface SocialSyncPayload {
  contaId?: string;
}

export interface SocialPostFilters {
  plataforma?: SocialPlatform;
  dataInicio: string;
  dataFim: string;
  tipoPost?: SocialPostType;
  campanhaId?: string;
}

export interface SocialPermissionFlags {
  canViewModule: boolean;
  canManageAccounts: boolean;
  canSync: boolean;
  canExportReports: boolean;
  canManageAlerts: boolean;
}

export const socialPermissions = [
  'social.visualizar',
  'social.configurar',
  'social.sincronizar',
  'social.exportar_relatorios',
  'social.gerenciar_alertas',
] as const;

export function getSocialPermissionFlags(roles: AppRole[]): SocialPermissionFlags {
  const has = (role: AppRole) => roles.includes(role);
  const canViewModule = has('admin') || has('vendedor') || has('financeiro');
  const canManageAccounts = has('admin') || has('vendedor');
  const canSync = has('admin') || has('vendedor');
  const canExportReports = has('admin') || has('vendedor') || has('financeiro');
  const canManageAlerts = has('admin') || has('vendedor');

  return { canViewModule, canManageAccounts, canSync, canExportReports, canManageAlerts };
}

export function socialPlatformLabel(plataforma: SocialPlatform): string {
  return plataforma === 'instagram_business' ? 'Instagram' : 'LinkedIn';
}
