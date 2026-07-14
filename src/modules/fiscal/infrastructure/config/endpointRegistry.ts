/**
 * Registry de endpoints SEFAZ (ADR-003). Etapa 4: leitura only,
 * cache TTL curto. Escrita/administração vem em etapa posterior.
 */
import { supabase } from '@/integrations/supabase/client';
import type { FiscalCache } from '../cache/fiscalCache';
import type { IEndpointRegistry } from '../../application/contracts';
import type { FiscalEndpoint } from '../../domain/entities';
import type { Ambiente, DocumentoFiscalTipo, UF } from '../../core/types';

const TTL_MS = 5 * 60_000;

export class EndpointRegistry implements IEndpointRegistry {
  constructor(private cache: FiscalCache) {}

  async resolve(input: {
    documento: DocumentoFiscalTipo;
    uf: UF;
    ambiente: Ambiente;
    servico: string;
    versao?: string;
  }): Promise<FiscalEndpoint | null> {
    const key = `fiscal:endpoint:${input.documento}:${input.uf}:${input.ambiente}:${input.servico}:${input.versao ?? 'latest'}`;
    const cached = this.cache.get<FiscalEndpoint>(key);
    if (cached) return cached;

    let query = supabase.from('fiscal_endpoints').select('*')
      .eq('documento', input.documento)
      .eq('uf', input.uf)
      .eq('ambiente', input.ambiente)
      .eq('servico', input.servico)
      .is('deleted_at', null)
      .order('atualizado_em', { ascending: false })
      .limit(1);
    if (input.versao) query = query.eq('versao', input.versao);

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;

    const ep: FiscalEndpoint = {
      documento: data.documento as DocumentoFiscalTipo,
      uf: data.uf as UF,
      ambiente: data.ambiente as Ambiente,
      servico: data.servico,
      versao: data.versao,
      url: data.url,
    };
    this.cache.set(key, ep, TTL_MS);
    return ep;
  }
}
