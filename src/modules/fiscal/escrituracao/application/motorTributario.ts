import type {
  DocumentoConsolidado,
  ParametroTributario,
  ResultadoCalculoTributo,
  Tributo,
} from '../domain/entities';
import { selecionarParametro } from '../domain/rules';

/**
 * Motor tributário parametrizável.
 * Nunca embute alíquotas — sempre consulta o registro de parâmetros vigente.
 */
export class MotorTributario {
  constructor(private readonly parametros: ParametroTributario[]) {}

  calcular(doc: DocumentoConsolidado, tributos: Tributo[]): ResultadoCalculoTributo[] {
    return tributos.map((tributo) => this.calcularUm(doc, tributo));
  }

  private calcularUm(doc: DocumentoConsolidado, tributo: Tributo): ResultadoCalculoTributo {
    const chave = this.montarChave(doc, tributo);
    const param = selecionarParametro(this.parametros, {
      chave,
      dataReferencia: doc.dataEmissao,
    });
    const base = this.baseDe(doc, tributo);
    if (!param || param.isento) {
      return {
        tributo,
        base,
        aliquota: 0,
        valor: 0,
        isento: !!param?.isento,
        origem: param ? 'parametro' : 'documento',
        parametroId: param?.id,
      };
    }
    const reducao = param.reducaoBase ?? 0;
    const baseAjustada = base * (1 - reducao);
    const valor = +(baseAjustada * param.aliquota).toFixed(2);
    return {
      tributo,
      base: baseAjustada,
      aliquota: param.aliquota,
      reducao,
      valor,
      isento: false,
      origem: 'parametro',
      parametroId: param.id,
    };
  }

  private montarChave(doc: DocumentoConsolidado, tributo: Tributo): string {
    return `${tributo}|CFOP:${doc.cfop ?? '-'}|NCM:${doc.ncm ?? '-'}`;
  }

  private baseDe(doc: DocumentoConsolidado, tributo: Tributo): number {
    switch (tributo) {
      case 'ICMS':
        return doc.baseIcms ?? doc.valorTotal;
      case 'ICMS_ST':
        return doc.baseIcmsSt ?? 0;
      default:
        return doc.valorTotal;
    }
  }
}
