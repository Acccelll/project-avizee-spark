export type WorkbookModoGeracao = 'dinamico' | 'fechado';
export type WorkbookStatus = 'pendente' | 'gerando' | 'concluido' | 'erro';
export type FechamentoStatus = 'aberto' | 'fechado';

export interface WorkbookTemplate {
  id: string;
  nome: string;
  codigo: string;
  versao: string;
  arquivo_path: string;
  estrutura_json: Record<string, unknown> | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkbookGeracao {
  id: string;
  template_id: string;
  empresa_id: string | null;
  competencia_inicial: string | null;
  competencia_final: string | null;
  modo_geracao: WorkbookModoGeracao | null;
  fechamento_id_inicial: string | null;
  fechamento_id_final: string | null;
  status: WorkbookStatus;
  arquivo_path: string | null;
  hash_geracao: string | null;
  parametros_json: Record<string, unknown> | null;
  observacoes: string | null;
  gerado_por: string | null;
  gerado_em: string;
  created_at: string;
  updated_at: string;
  workbook_templates?: WorkbookTemplate;
}

export interface FechamentoMensal {
  id: string;
  empresa_id: string | null;
  competencia: string;
  status: FechamentoStatus;
  fechado_em: string | null;
  fechado_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkbookParametros {
  templateId: string;
  competenciaInicial: string;
  competenciaFinal: string;
  modoGeracao: WorkbookModoGeracao;
  aborarSelecionadas: string[];
}

// RAW sheet data shapes
export interface RawFinanceiroRow {
  tipo: string;
  data_vencimento: string;
  valor: number;
  valor_pago: number;
  saldo_restante: number;
  status: string;
  conta_contabil_id: string | null;
  conta_descricao: string;
  competencia: string;
}

export interface RawCaixaRow {
  competencia: string;
  conta_bancaria_id: string | null;
  conta_descricao: string;
  tipo: string;
  total_valor: number;
  qtd_movimentos: number;
}

export interface RawAgingRow {
  id: string;
  data_vencimento: string;
  valor: number;
  valor_pago: number;
  saldo_aberto: number;
  status: string;
  parceiro_id: string | null;
  faixa_aging: string;
}

export interface RawEstoqueRow {
  produto_id: string;
  nome: string;
  sku: string | null;
  quantidade: number;
  custo_unitario: number;
  valor_total: number;
  grupo_id: string | null;
  grupo_descricao: string | null;
}

export interface RawFopagRow {
  id: string;
  competencia: string;
  funcionario_id: string | null;
  funcionario_nome: string | null;
  cargo: string | null;
  departamento: string | null;
  salario_base: number;
  proventos: number;
  descontos: number;
  valor_liquido: number;
  status: string | null;
}

export interface RawBancosRow {
  id: string;
  descricao: string;
  agencia: string | null;
  conta: string | null;
  saldo_atual: number;
  banco_nome: string | null;
}

export interface RawParametrosRow {
  chave: string;
  valor: string;
}
