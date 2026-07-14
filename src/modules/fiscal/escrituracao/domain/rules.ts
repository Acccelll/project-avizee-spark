import type {
  DocumentoConsolidado,
  InconsistenciaFiscal,
  ParametroTributario,
  RegimeTributario,
} from './entities';

/** CFOPs de entrada iniciam com 1, 2 ou 3; saída com 5, 6 ou 7. */
export function cfopCompativelComOperacao(cfop: string, operacao: 'entrada' | 'saida'): boolean {
  if (!/^\d{4}$/.test(cfop)) return false;
  const primeiro = cfop[0];
  if (operacao === 'entrada') return ['1', '2', '3'].includes(primeiro);
  return ['5', '6', '7'].includes(primeiro);
}

/** CSTs ICMS válidos (Regime Normal) e CSOSN (Simples Nacional). */
const CST_ICMS_VALIDOS = new Set([
  '00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90',
]);
const CSOSN_VALIDOS = new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900']);

export function cstIcmsValido(cst: string): boolean {
  return CST_ICMS_VALIDOS.has(cst);
}

export function csosnValido(csosn: string): boolean {
  return CSOSN_VALIDOS.has(csosn);
}

export function classificacaoValidaParaRegime(
  regime: RegimeTributario,
  cst?: string,
  csosn?: string,
): boolean {
  if (regime === 'simples_nacional') return !!csosn && csosnValido(csosn);
  return !!cst && cstIcmsValido(cst);
}

/** Seleciona o parâmetro mais específico e vigente. */
export function selecionarParametro(
  parametros: ParametroTributario[],
  filtro: { chave: string; dataReferencia: string },
): ParametroTributario | undefined {
  const candidatos = parametros.filter((p) => {
    if (p.chave !== filtro.chave) return false;
    if (p.vigenciaInicio > filtro.dataReferencia) return false;
    if (p.vigenciaFim && p.vigenciaFim < filtro.dataReferencia) return false;
    return true;
  });
  return candidatos.sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio))[0];
}

/** Detecta inconsistências elementares em um documento consolidado. */
export function detectarInconsistencias(
  doc: DocumentoConsolidado,
  regime: RegimeTributario,
): InconsistenciaFiscal[] {
  const out: InconsistenciaFiscal[] = [];
  const now = new Date().toISOString();
  if (doc.cfop && !cfopCompativelComOperacao(doc.cfop, doc.operacao)) {
    out.push({
      id: `${doc.id}:cfop`,
      periodoId: doc.periodoId,
      documentoId: doc.id,
      tipo: 'cfop_incompativel',
      severidade: 'alta',
      mensagem: `CFOP ${doc.cfop} incompatível com operação ${doc.operacao}`,
      detectadoEm: now,
    });
  }
  if (!classificacaoValidaParaRegime(regime, doc.cst, doc.csosn)) {
    out.push({
      id: `${doc.id}:cst`,
      periodoId: doc.periodoId,
      documentoId: doc.id,
      tipo: 'cst_invalido',
      severidade: 'alta',
      mensagem: `Classificação tributária inválida para regime ${regime}`,
      detectadoEm: now,
    });
  }
  return out;
}
