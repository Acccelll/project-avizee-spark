/**
 * Escrita append-only em fiscal_auditoria. UPDATE/DELETE são bloqueados
 * por trigger no banco. Falhas de auditoria NÃO abortam o fluxo fiscal.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AuditoriaEntry, IAuditoriaRepository } from '../../application/contracts';
import { fiscalLogger } from '../logging/fiscalLogger';

export class AuditoriaRepository implements IAuditoriaRepository {
  async record(entry: AuditoriaEntry): Promise<void> {
    try {
      const payload = {
        empresa_id: entry.empresaId ?? null,
        correlation_id: entry.correlationId,
        operacao: entry.operacao,
        ator: entry.ator ?? null,
        documento: entry.documento ?? null,
        chave_acesso: entry.chaveAcesso ?? null,
        request_hash: entry.requestHash ?? null,
        response_status: entry.responseStatus ?? null,
        cstat: entry.cstat ?? null,
        xmotivo: entry.xmotivo ?? null,
        duracao_ms: entry.duracaoMs ?? null,
        endpoint_url: entry.endpointUrl ?? null,
        retryable: entry.retryable ?? null,
        tentativa: entry.tentativa ?? null,
        payload_extra: (entry.payloadExtra ?? null) as never,
      };
      const { error } = await supabase.from('fiscal_auditoria').insert(payload as never);
      if (error) fiscalLogger.warn('auditoria.insert.falhou', { error: error.message });
    } catch (err) {
      fiscalLogger.warn('auditoria.insert.exception', { err: String(err) });
    }
  }
}
