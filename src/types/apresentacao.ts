export type ApresentacaoModoGeracao = 'dinamico' | 'fechado';
export type ApresentacaoStatus = 'pendente' | 'gerando' | 'concluido' | 'erro';
export type ApresentacaoStatusEditorial = 'rascunho' | 'revisao' | 'aprovado' | 'gerado';
export type ComentarioStatus = 'automatico' | 'editado' | 'aprovado';

/** Fase de implementação do slide. */
export type SlideFase = 'v1' | 'v2';

/**
 * Determines in which generation modes a slide can produce real data.
 * 'both'     = dynamic and closed modes
 * 'dinamico' = live views only
 * 'fechado'  = snapshot tables only
 */
export type SlideModeSupport = 'both' | 'dinamico' | 'fechado';

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
  /** Editorial workflow status (V2). */
  status_editorial: ApresentacaoStatusEditorial;
  aprovado_por: string | null;
  aprovado_em: string | null;
  total_slides: number | null;
  slides_config_json: Record<string, unknown>[] | null;
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
  /** 1 = normal, 5 = critical (V2). */
  prioridade: number;
  /** automatico | editado | aprovado (V2). */
  comentario_status: ComentarioStatus;
  tags_json: string[] | null;
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

// -------------------------------------------------------
// V2 analytical data types
// -------------------------------------------------------

export interface AgingItem {
  tipo: string;
  data_vencimento: string;
  faixa_aging: string;
  status: string;
  saldo_aberto: number;
  quantidade: number;
}

export interface TopClienteItem {
  competencia: string;
  cliente_id: string;
  cliente_nome: string;
  estado: string;
  total_pedidos: number;
  total_vendas: number;
  ticket_medio: number;
}

export interface TopFornecedorItem {
  competencia: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  total_compras: number;
  total_pago: number;
  quantidade_titulos: number;
}

export interface InadimplenciaItem {
  competencia_vencimento: string;
  faixa_atraso: string;
  quantidade_titulos: number;
  saldo_inadimplente: number;
  clientes_inadimplentes: number;
}

export interface BackorderItem {
  competencia: string;
  pedido_id: string;
  cliente_nome: string;
  status: string;
  valor_total: number;
  data_pedido: string;
  dias_em_aberto: number;
}

export interface DreLinhaItem {
  competencia: string;
  linha_dre: string;
  linha_gerencial: string;
  sinal_padrao: number;
  valor_total: number;
}

export interface ResultadoFinanceiroItem {
  competencia: string;
  grupo: string;
  tipo: string;
  valor_total: number;
  valor_realizado: number;
}

export interface TributoItem {
  competencia: string;
  grupo_tributo: string;
  valor_total: number;
  valor_pago: number;
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
  // V2
  aging: AgingItem[];
  topClientes: TopClienteItem[];
  topFornecedores: TopFornecedorItem[];
  inadimplencia: InadimplenciaItem[];
  backorder: BackorderItem[];
  dreGerencial: DreLinhaItem[];
  resultadoFinanceiro: ResultadoFinanceiroItem[];
  tributos: TributoItem[];
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
  | 'waterfall'
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
  /** If true the slide cannot be deactivated by a template. */
  required?: boolean;
  /** If true the slide is off by default and must be explicitly enabled. */
  optional?: boolean;
  /** Other slide codigos that must be active for this slide to be active. */
  dependsOn?: string[];
  /** Hide the slide instead of showing a "no data" placeholder when data is empty. */
  hiddenWhenEmpty?: boolean;
  /** Which generation modes produce real data for this slide. */
  modeSupport?: SlideModeSupport;
  /** Default display order within the slide catalogue. */
  order?: number;
  /** Implementation phase. */
  fase?: SlideFase;
  /**
   * When the underlying data is not yet fully automated,
   * set this to a human-readable note explaining the limitation.
   * The engine will render a placeholder slide instead of crashing.
   */
  notaAutomacao?: string;
}

export interface SlideComentarioInput {
  codigo: string;
  comentario_automatico: string;
  titulo: string;
  ordem: number;
  /** 1–5 severity/priority (V2). Defaults to 1. */
  prioridade?: number;
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
