/**
 * Registro de chaves de idempotência. Expira em 24h (via coluna default).
 */
import { supabase } from '@/integrations/supabase/client';
import type { IIdempotencyRepository } from '../../application/contracts';

export class IdempotencyRepository implements IIdempotencyRepository {
  async register(empresaId: string, key: string): Promise<'new' | 'duplicate'> {
    const { error } = await supabase.from('fiscal_idempotency').insert({
      empresa_id: empresaId, key,
    });
    if (!error) return 'new';
    // 23505 = unique_violation
    if ((error as { code?: string }).code === '23505') return 'duplicate';
    throw error;
  }

  async complete(empresaId: string, key: string, hash: string, status: number): Promise<void> {
    const { error } = await supabase.from('fiscal_idempotency')
      .update({ response_hash: hash, response_status: status })
      .eq('empresa_id', empresaId).eq('key', key);
    if (error) throw error;
  }
}
