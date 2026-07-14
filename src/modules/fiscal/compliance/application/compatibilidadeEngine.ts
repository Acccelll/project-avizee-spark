import type { IArtefatoRepository, IAlertaCompatibilidadeSink } from './contracts';
import type { AlertaCompatibilidade, NivelImpacto } from '../domain/entities';

export interface AmbienteFiscalRef {
  empresaId: string;
  artefatoId: string;
  versaoUsada: string;
  certificadoValidoAte?: string;
  endpointAtivo?: boolean;
}

/**
 * Engine de compatibilidade — valida versões em uso vs. versões vigentes,
 * certificados e endpoints. Emite alertas preventivos.
 */
export class CompatibilidadeEngine {
  constructor(
    private readonly artefatos: IArtefatoRepository,
    private readonly sink: IAlertaCompatibilidadeSink,
  ) {}

  async validar(amb: AmbienteFiscalRef, refIso = new Date().toISOString()): Promise<AlertaCompatibilidade[]> {
    const alertas: AlertaCompatibilidade[] = [];
    const push = (nivel: NivelImpacto, motivo: string) => {
      alertas.push({
        id: `${amb.empresaId}:${amb.artefatoId}:${Date.now()}:${alertas.length}`,
        artefatoId: amb.artefatoId,
        versao: amb.versaoUsada,
        nivel,
        motivo,
        detectadoEm: refIso,
      });
    };

    const vigente = await this.artefatos.getVersaoVigente(amb.artefatoId, refIso);
    if (!vigente) push('alto', 'Nenhuma versão vigente registrada para o artefato');
    else if (vigente.versao !== amb.versaoUsada) {
      const coexiste = vigente.compatibilidadeCom?.includes(amb.versaoUsada);
      push(coexiste ? 'medio' : 'critico',
        coexiste ? `Versão ${amb.versaoUsada} coexiste, mas vigente é ${vigente.versao}`
                 : `Versão ${amb.versaoUsada} incompatível com vigente ${vigente.versao}`);
    }
    if (amb.certificadoValidoAte && amb.certificadoValidoAte < refIso) {
      push('critico', 'Certificado digital expirado');
    }
    if (amb.endpointAtivo === false) push('alto', 'Endpoint SEFAZ inativo');

    for (const a of alertas) await this.sink.publish(a);
    return alertas;
  }
}
