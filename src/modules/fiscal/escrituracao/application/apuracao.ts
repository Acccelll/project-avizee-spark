import type {
  ApuracaoPeriodo,
  ApuracaoTributo,
  DocumentoConsolidado,
  ResultadoCalculoTributo,
  Tributo,
} from '../domain/entities';
import { MotorTributario } from './motorTributario';
import type { EscrituracaoDeps } from './contracts';

export interface EntradaApuracao {
  periodoId: string;
  empresaId: string;
  tributos: Tributo[];
  saldosAnteriores?: Partial<Record<Tributo, number>>;
}

/**
 * Motor de apuração tributária.
 * Calcula débitos/créditos por tributo, respeitando saldo anterior e ajustes.
 */
export class ApuracaoTributaria {
  constructor(private readonly deps: EscrituracaoDeps) {}

  async executar(entrada: EntradaApuracao): Promise<ApuracaoPeriodo> {
    const [docs, params] = await Promise.all([
      this.deps.documentos.listarPorPeriodo(entrada.periodoId),
      this.deps.parametros.listar(entrada.empresaId),
    ]);
    const motor = new MotorTributario(params);
    const tributos: ApuracaoTributo[] = entrada.tributos.map((t) =>
      this.apurarTributo(t, docs, motor, entrada.saldosAnteriores?.[t] ?? 0),
    );
    const totalDebitos = tributos.reduce((s, t) => s + t.debitos, 0);
    const totalCreditos = tributos.reduce((s, t) => s + t.creditos, 0);
    const totalAPagar = tributos.reduce((s, t) => s + t.saldoAPagar, 0);
    const apuracao: ApuracaoPeriodo = {
      periodoId: entrada.periodoId,
      empresaId: entrada.empresaId,
      geradoEm: new Date().toISOString(),
      tributos,
      totalDebitos,
      totalCreditos,
      totalAPagar,
    };
    await this.deps.apuracoes.salvar(apuracao);
    return apuracao;
  }

  private apurarTributo(
    tributo: Tributo,
    docs: DocumentoConsolidado[],
    motor: MotorTributario,
    saldoAnterior: number,
  ): ApuracaoTributo {
    const detalhamento: ResultadoCalculoTributo[] = [];
    let debitos = 0;
    let creditos = 0;
    for (const doc of docs) {
      if (doc.situacao !== 'valido') continue;
      const [r] = motor.calcular(doc, [tributo]);
      detalhamento.push(r);
      if (doc.operacao === 'saida') debitos += r.valor;
      else creditos += r.valor;
    }
    const bruto = debitos - creditos - saldoAnterior;
    return {
      tributo,
      debitos: +debitos.toFixed(2),
      creditos: +creditos.toFixed(2),
      ajustes: 0,
      saldoAnterior,
      saldoAPagar: bruto > 0 ? +bruto.toFixed(2) : 0,
      saldoCredor: bruto < 0 ? +Math.abs(bruto).toFixed(2) : 0,
      detalhamento,
    };
  }
}
