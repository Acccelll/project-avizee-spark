import type { HardeningItem } from '../types';

/**
 * Checklist canônico de hardening do Framework Fiscal.
 * Cada item mapeia uma decisão arquitetural já materializada nas etapas anteriores.
 */
export const HARDENING_CHECKLIST_BASE: Omit<HardeningItem, 'ok'>[] = [
  { categoria: 'auth', item: 'RBAC granular via user_permissions + can(resource, action)' },
  { categoria: 'auth', item: 'MFA TOTP opcional habilitado' },
  { categoria: 'rls', item: 'RLS habilitada em todas as tabelas fiscal_*' },
  { categoria: 'rls', item: 'Policies escopadas por empresa via user_empresas' },
  { categoria: 'cripto', item: 'Assinatura XML via SignatureEngine (SHA-1/RSA — layout SEFAZ)' },
  { categoria: 'certificado', item: 'Certificados A1 armazenados em bucket privado; metadata em fiscal_certificado_metadata' },
  { categoria: 'certificado', item: 'Alerta de vencimento ≤ 30 dias (CertificadoService)' },
  { categoria: 'logs', item: 'Logger centralizado (src/lib/logger.ts) — console.* proibido' },
  { categoria: 'logs', item: 'Logs estruturados sem PII em edge functions' },
  { categoria: 'secrets', item: 'Credenciais em Supabase Vault via RPCs SECURITY DEFINER' },
  { categoria: 'exposicao', item: 'Nenhum endpoint público expõe XML autorizado sem RLS' },
  { categoria: 'exceptions', item: 'Erros de domínio via classes tipadas em core/errors.ts' },
  { categoria: 'exceptions', item: 'CORS restrito por ALLOWED_ORIGIN nas funções admin' },
];

export class HardeningChecklist {
  avaliar(estado: Partial<Record<string, boolean>>): HardeningItem[] {
    return HARDENING_CHECKLIST_BASE.map((i) => ({ ...i, ok: estado[i.item] ?? true }));
  }

  resumo(items: HardeningItem[]): { total: number; ok: number; pendentes: string[] } {
    const pendentes = items.filter((i) => !i.ok).map((i) => i.item);
    return { total: items.length, ok: items.length - pendentes.length, pendentes };
  }
}
