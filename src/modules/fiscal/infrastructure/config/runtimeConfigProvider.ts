/**
 * Provider de configuração de runtime por empresa (fallback default).
 */
import { supabase } from '@/integrations/supabase/client';
import type { FiscalCache } from '../cache/fiscalCache';
import type { IRuntimeConfigProvider } from '../../application/contracts';
import type { ConfiguracaoFiscal } from '../../domain/entities';

const TTL_MS = 60_000;

const DEFAULT: ConfiguracaoFiscal = {
  empresaId: null,
  timeoutAutorizacaoMs: 15000,
  timeoutStatusMs: 8000,
  politicaRetry: { max: 3, backoffMs: [500, 1500, 4000] },
  contingenciaHabilitada: false,
  syncAutoCiencia: false,
};

export class RuntimeConfigProvider implements IRuntimeConfigProvider {
  constructor(private cache: FiscalCache) {}

  async getForEmpresa(empresaId: string | null): Promise<ConfiguracaoFiscal> {
    const key = `fiscal:runtimeConfig:${empresaId ?? 'default'}`;
    const cached = this.cache.get<ConfiguracaoFiscal>(key);
    if (cached) return cached;

    const q = supabase.from('fiscal_runtime_config').select('*').limit(1);
    const query = empresaId ? q.eq('empresa_id', empresaId) : q.is('empresa_id', null);
    const { data } = await query.maybeSingle();

    const retryJson = (data?.politica_retry ?? {}) as { max?: number; backoff_ms?: number[] };
    const cfg: ConfiguracaoFiscal = data
      ? {
          empresaId,
          timeoutAutorizacaoMs: data.timeout_autorizacao_ms,
          timeoutStatusMs: data.timeout_status_ms,
          politicaRetry: {
            max: retryJson.max ?? DEFAULT.politicaRetry.max,
            backoffMs: retryJson.backoff_ms ?? DEFAULT.politicaRetry.backoffMs,
          },
          contingenciaHabilitada: !!data.contingencia_habilitada,
          syncAutoCiencia: !!data.sync_auto_ciencia,
        }
      : { ...DEFAULT, empresaId };

    this.cache.set(key, cfg, TTL_MS);
    return cfg;
  }
}
