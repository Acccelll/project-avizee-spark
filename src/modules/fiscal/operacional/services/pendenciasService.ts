import type { PendenciaFiscal, PendenciaSeveridade, PendenciaTipo } from '../types';

export interface IPendenciasRepository {
  listar(filtro?: { empresaId?: string; tipo?: PendenciaTipo; aberto?: boolean }): Promise<PendenciaFiscal[]>;
  registrar(p: PendenciaFiscal): Promise<PendenciaFiscal>;
  resolver(id: string, usuarioId: string, observacao?: string): Promise<PendenciaFiscal>;
}

/**
 * Serviço de gestão de pendências fiscais.
 * Sugere ação assistida por tipo — nunca resolve automaticamente.
 */
export class PendenciasService {
  constructor(private readonly repo: IPendenciasRepository) {}

  async abertas(empresaId?: string): Promise<PendenciaFiscal[]> {
    return this.repo.listar({ empresaId, aberto: true });
  }

  async resumo(empresaId?: string): Promise<Record<PendenciaSeveridade, number>> {
    const items = await this.abertas(empresaId);
    const acc: Record<PendenciaSeveridade, number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
    for (const p of items) acc[p.severidade]++;
    return acc;
  }

  sugerirAcao(p: Pick<PendenciaFiscal, 'tipo'>): string {
    switch (p.tipo) {
      case 'nfe_rejeitada': return 'Analisar motivo da rejeição e reemitir após correção.';
      case 'inconsistencia_fiscal': return 'Revisar parametrização (CFOP/CST) e recalcular apuração.';
      case 'falha_integracao': return 'Reprocessar job na Central de Processamentos.';
      case 'erro_tributario': return 'Validar regime tributário e parâmetro vigente.';
      case 'cadastro_incompleto': return 'Completar cadastro (endereço/IE/CNPJ) antes de reprocessar.';
      case 'xml_invalido': return 'Validar contra o XSD e reenviar o arquivo.';
      case 'falha_assinatura': return 'Verificar validade do certificado A1 e senha configurada.';
      case 'certificado_expirado': return 'Substituir o certificado antes de qualquer nova emissão.';
    }
  }
}
