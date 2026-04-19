/**
 * Template-first workbook generator.
 * 1. Loads the physical .xlsx template
 * 2. Fetches data (dynamic or closed mode)
 * 3. Fills RAW sheets with data
 * 4. Builds visual/analytical sheets
 * 5. Updates parameters
 * 6. Exports preserving template structure
 */
import ExcelJS from 'exceljs';
import { fetchWorkbookData } from './fetchWorkbookData';
import { fillRawSheets } from './fillRawSheets';
import { buildVisualSheets } from './buildVisualSheets';
import { VISUAL_SHEET_NAMES } from './templateMap';
import { hashParametros } from './utils';
import type { WorkbookParametros } from '@/types/workbook';

export interface GenerateWorkbookOptions {
  parametros: WorkbookParametros;
  geracaoId: string;
}

// Template is served from /public so the path is stable across dev and prod
// builds (Vite leaves files under public/ untouched and without hash).
const TEMPLATE_URL = '/workbook_gerencial_v1.xlsx';

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  let response: Response;
  try {
    response = await fetch(TEMPLATE_URL);
  } catch (err) {
    throw new Error(
      `Template do workbook não pôde ser carregado (${TEMPLATE_URL}). Verifique sua conexão e tente novamente.`,
    );
  }
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    await wb.xlsx.load(buffer);
    return wb;
  }

  // Template missing on server — fall back to a minimal scaffold but warn loudly.
  console.warn(
    `[workbook] Template não encontrado em ${TEMPLATE_URL} (HTTP ${response.status}). Gerando estrutura mínima — contate o suporte.`,
  );
  wb.creator = 'ERP AviZee';
  wb.created = new Date();
  
  // Create RAW sheets with headers
  const rawSheets: Record<string, string[]> = {
    'RAW_Receita': ['competencia', 'total_receita', 'total_recebido', 'quantidade'],
    'RAW_Despesa': ['competencia', 'total_despesa', 'total_pago', 'quantidade'],
    'RAW_Faturamento': ['competencia', 'total_faturado', 'quantidade_nfs'],
    'RAW_FOPAG': ['competencia', 'funcionario_nome', 'salario_base', 'proventos', 'descontos', 'valor_liquido'],
    'RAW_Caixa': ['conta_descricao', 'banco_nome', 'agencia', 'conta', 'saldo_atual'],
    'RAW_Estoque': ['produto_nome', 'sku', 'grupo_nome', 'quantidade', 'custo_unitario', 'valor_total'],
    'RAW_AgingCR': ['id', 'data_vencimento', 'valor', 'valor_pago', 'saldo_aberto', 'status', 'cliente_id', 'descricao'],
    'RAW_AgingCP': ['id', 'data_vencimento', 'valor', 'valor_pago', 'saldo_aberto', 'status', 'fornecedor_id', 'descricao'],
    'RAW_Parametros': ['chave', 'valor'],
  };
  
  for (const [name, headers] of Object.entries(rawSheets)) {
    const ws = wb.addWorksheet(name);
    const row = ws.addRow(headers);
    row.font = { bold: true };
  }
  
  // Create visual sheet placeholders
  for (const name of Object.values(VISUAL_SHEET_NAMES)) {
    wb.addWorksheet(name);
  }
  
  return wb;
}

export async function generateWorkbook(options: GenerateWorkbookOptions): Promise<Blob> {
  const { parametros, geracaoId } = options;
  const { competenciaInicial, competenciaFinal, modoGeracao } = parametros;

  // 1. Load template
  const workbook = await loadTemplate();
  workbook.creator = 'ERP AviZee';
  workbook.lastModifiedBy = 'Workbook Gerencial';
  workbook.modified = new Date();

  // 2. Fetch data using appropriate mode
  const data = await fetchWorkbookData(competenciaInicial, competenciaFinal, modoGeracao);

  // 3. Fill RAW sheets
  fillRawSheets(workbook, data, parametros, geracaoId);

  // 4. Build visual/analytical sheets from data
  buildVisualSheets(workbook, data, competenciaInicial, competenciaFinal);

  // 5. Update Parâmetros visual sheet
  const wsParam = workbook.getWorksheet(VISUAL_SHEET_NAMES.PARAMETROS);
  if (wsParam) {
    wsParam.spliceRows(1, wsParam.rowCount);
    wsParam.addRow(['Chave', 'Valor']);
    const hr = wsParam.getRow(1);
    for (let c = 1; c <= 2; c++) {
      hr.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      hr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    }
    wsParam.addRow(['competencia_inicial', competenciaInicial]);
    wsParam.addRow(['competencia_final', competenciaFinal]);
    wsParam.addRow(['modo_geracao', modoGeracao]);
    wsParam.addRow(['gerado_em', new Date().toISOString()]);
    wsParam.addRow(['geracao_id', geracaoId]);
    wsParam.addRow(['hash', hashParametros(parametros as unknown as Record<string, unknown>)]);
    wsParam.getColumn(1).width = 22;
    wsParam.getColumn(2).width = 40;
  }

  // 6. Export
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
