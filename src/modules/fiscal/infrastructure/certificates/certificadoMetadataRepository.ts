/**
 * Metadados de certificados A1. O binário e a senha ficam em
 * Supabase Storage + Vault (esta etapa não implementa upload/leitura).
 */
import { supabase } from '@/integrations/supabase/client';
import type { ICertificadoMetadataRepository } from '../../application/contracts';
import type { CertificadoDigital } from '../../domain/entities';

export class CertificadoMetadataRepository implements ICertificadoMetadataRepository {
  async getByEmpresa(empresaId: string): Promise<CertificadoDigital | null> {
    // @ts-expect-error tabela fiscal_certificado_metadata — tipos regenerados em outra tarefa
    const { data, error } = await supabase.from('fiscal_certificado_metadata')
      .select('*').eq('empresa_id', empresaId).maybeSingle();
    if (error || !data) return null;
    return {
      empresaId: data.empresa_id,
      cnpj: data.cnpj,
      serial: data.serial ?? undefined,
      subjectCn: data.subject_cn ?? undefined,
      validadeInicio: data.validade_inicio ?? undefined,
      validadeFim: data.validade_fim ?? undefined,
      storagePath: data.storage_path ?? undefined,
      vaultSecretName: data.vault_secret_name ?? undefined,
    };
  }

  async upsert(cert: CertificadoDigital): Promise<void> {
    // @ts-expect-error tabela fiscal_certificado_metadata — tipos regenerados em outra tarefa
    const { error } = await supabase.from('fiscal_certificado_metadata').upsert({
      empresa_id: cert.empresaId,
      cnpj: cert.cnpj,
      serial: cert.serial,
      subject_cn: cert.subjectCn,
      validade_inicio: cert.validadeInicio,
      validade_fim: cert.validadeFim,
      storage_path: cert.storagePath,
      vault_secret_name: cert.vaultSecretName,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });
    if (error) throw error;
  }
}
