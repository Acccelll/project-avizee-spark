export type ApresentacaoModoGeracao = 'dinamico' | 'fechado';
export type ApresentacaoStatus = 'pendente' | 'gerando' | 'concluido' | 'erro';

export interface ApresentacaoTemplate {
  id: string;
  nome: string;
  codigo: string;
  versao: string;
  ativo: boolean;
  descricao: string | null;
  config_json: Record<string, unknown> | null;
  arquivo_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApresentacaoGeracao {
  id: string;
  template_id: string;
  empresa_id: string | null;
  competencia_inicial: string | null;
  competencia_final: string | null;
  modo_geracao: ApresentacaoModoGeracao | null;
  fechamento_id_inicial: string | null;
  fechamento_id_final: string | null;
  status: ApresentacaoStatus;
  arquivo_path: string | null;
  hash_geracao: string | null;
  parametros_json: Record<string, unknown> | null;
  observacoes: string | null;
  gerado_por: string | null;
  gerado_em: string;
  created_at: string;
  updated_at: string;
  apresentacao_templates?: ApresentacaoTemplate;
}

export interface ApresentacaoComentario {
  id: string;
  geracao_id: string;
  slide_codigo: string;
  titulo: string | null;
  comentario_automatico: string | null;
  comentario_editado: string | null;
  origem: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface ApresentacaoParametros {
  templateId: string;
  competenciaInicial: string;
  competenciaFinal: string;
  modoGeracao: ApresentacaoModoGeracao;
}

// -------------------------------------------------------
// Analytical data types (from vw_apresentacao_* views)
// -------------------------------------------------------

export interface HighlightFinanceiro {
  competencia: string;
  total_receita: number;
  total_recebido: number;
  total_despesa: number;
  total_pago: number;
  resultado_bruto: number;
}

export interface FaturamentoMensal {
  competencia: string;
  quantidade_nfs: number;
  total_faturado: number;
  total_produtos: number;
  total_desconto: number;
}

export interface DespesaCategoria {
  competencia: string;
  categoria: string;
  total_despesa: number;
  total_pago: number;
  quantidade: number;
}

export interface RolCaixa {
  conta_bancaria_id: string;
  conta_descricao: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  saldo_atual: number;
}

export interface ReceitaVsDespesa {
  competencia: string;
  total_receita: number;
  total_recebido: number;
  total_despesa: number;
  total_pago: number;
  resultado_bruto: number;
  receita_mes_anterior: number | null;
  despesa_mes_anterior: number | null;
}

export interface FopagResumo {
  competencia: string;
  funcionario_nome: string;
  salario_base: number;
  proventos: number;
  descontos: number;
  valor_liquido: number;
}

export interface FluxoCaixa {
  competencia: string;
  total_entradas: number;
  total_saidas: number;
  saldo_periodo: number;
}

export interface LucroItem {
  competencia: string;
  produto_id: string;
  produto_nome: string;
  produto_sku: string;
  cliente_id: string;
  cliente_nome: string;
  quantidade_vendida: number;
  receita_bruta: number;
  custo_total: number;
  margem_bruta: number;
}

export interface EstoqueItem {
  produto_id: string;
  produto_nome: string;
  produto_sku: string;
  grupo_nome: string;
  quantidade_atual: number;
  custo_unitario: number;
  valor_total: number;
}

export interface VendaEstado {
  competencia: string;
  estado: string;
  quantidade_pedidos: number;
  total_vendas: number;
  clientes_ativos: number;
}

export interface RedesSociais {
  competencia: string;
  plataforma: string;
  metrica: string;
  valor: number;
}

export interface ApresentacaoRawData {
  highlights: HighlightFinanceiro[];
  faturamento: FaturamentoMensal[];
  despesas: DespesaCategoria[];
  rolCaixa: RolCaixa[];
  receitaVsDespesa: ReceitaVsDespesa[];
  fopag: FopagResumo[];
  fluxoCaixa: FluxoCaixa[];
  lucro: LucroItem[];
  estoque: EstoqueItem[];
  vendaEstado: VendaEstado[];
  redesSociais: RedesSociais[];
}

// -------------------------------------------------------
// Slide definition types
// -------------------------------------------------------

export type SlideChartType =
  | 'coluna'
  | 'linha'
  | 'barra_horizontal'
  | 'pizza'
  | 'donut'
  | 'tabela'
  | 'kpi_card'
  | 'none';

export interface SlideDefinition {
  codigo: string;
  titulo: string;
  subtitulo: string;
  chartType: SlideChartType;
  datasets: string[];
  placeholders: string[];
  comentarioTemplate: string;
  dependencias: (keyof ApresentacaoRawData)[];
  condicaoExibicao?: (data: ApresentacaoRawData) => boolean;
}

export interface SlideComentarioInput {
  codigo: string;
  comentario_automatico: string;
  titulo: string;
  ordem: number;
}
