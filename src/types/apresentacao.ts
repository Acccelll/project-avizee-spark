export type ApresentacaoModoGeracao = 'dinamico' | 'fechado';
export type ApresentacaoStatus = 'pendente' | 'gerando' | 'concluido' | 'erro';

export interface ApresentacaoTemplate {
  id: string;
  nome: string;
  codigo: string;
  versao: string;
  ativo: boolean;
  descricao: string | null;
  config_json: TemplateConfig | null;
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

// -------------------------------------------------------
// Template config — stored in apresentacao_templates.config_json
// -------------------------------------------------------

/** Theme overrides: only colors and fonts can be customised; layout dimensions are fixed. */
export interface TemplateThemeConfig {
  /** Hex colour WITHOUT the leading # (e.g. "1F3864"). */
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontTitle?: string;
  fontBody?: string;
  /** Path inside the "dbavizee" Supabase Storage bucket (same as arquivo_path). */
  logoUrl?: string;
}

/** Per-slide override inside a template. */
export interface TemplateSlideConfig {
  /** Must match a `codigo` in SLIDE_DEFINITIONS. */
  codigo: string;
  /** Whether the slide is included in the generated presentation. */
  ativo: boolean;
  /** Display order (0-based). */
  ordem: number;
  /** If set, replaces the default SlideDefinition.titulo. */
  tituloCustom?: string;
  /** If set, replaces the default SlideDefinition.subtitulo. */
  subtituloCustom?: string;
}

/** Root config_json schema for a template (versionable). */
export interface TemplateConfig {
  version: '1.0';
  theme?: TemplateThemeConfig;
  /** Sparse: only slides that deviate from defaults need to be listed. */
  slides?: TemplateSlideConfig[];
}

/** Resolved theme — all fields guaranteed to have a value. */
export interface ResolvedTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    danger: string;
    warning: string;
    white: string;
    lightGray: string;
    darkGray: string;
    mediumGray: string;
    background: string;
    chartSeries: string[];
  };
  fonts: {
    title: string;
    body: string;
    mono: string;
  };
  fontSizes: {
    coverTitle: number;
    coverSubtitle: number;
    slideTitle: number;
    slideSubtitle: number;
    kpiValue: number;
    kpiLabel: number;
    body: number;
    caption: number;
    comment: number;
    tableHeader: number;
    tableBody: number;
  };
  slide: {
    widthInches: number;
    heightInches: number;
  };
  logoUrl?: string;
}

/** Resolved slide entry used by the generation engine. */
export interface ResolvedSlide {
  codigo: string;
  ativo: boolean;
  ordem: number;
  titulo: string;
  subtitulo: string;
}
