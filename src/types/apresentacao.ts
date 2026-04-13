export type ApresentacaoModoGeracao = 'dinamico' | 'fechado';
export type ApresentacaoStatus = 'pendente' | 'gerando' | 'concluido' | 'erro';
export type ApresentacaoStatusEditorial = 'rascunho' | 'revisao' | 'aprovado' | 'gerado';
export type ComentarioStatus = 'automatico' | 'editado' | 'aprovado';

export type SlideCodigo =
  | 'cover'
  | 'highlights_financeiros'
  | 'faturamento'
  | 'despesas'
  | 'rol_caixa'
  | 'receita_vs_despesa'
  | 'fopag'
  | 'fluxo_caixa'
  | 'lucro_produto_cliente'
  | 'variacao_estoque'
  | 'venda_estado'
  | 'redes_sociais'
  | 'bridge_ebitda'
  | 'bridge_lucro_liquido'
  | 'dre_gerencial'
  | 'capital_giro'
  | 'balanco_gerencial'
  | 'resultado_financeiro'
  | 'tributos'
  | 'aging_consolidado'
  | 'debt'
  | 'bancos_detalhado'
  | 'backorder'
  | 'top_clientes'
  | 'top_fornecedores'
  | 'inadimplencia'
  | 'performance_comercial_canal'
  | 'closing';

export interface SlideConfigItem {
  codigo: SlideCodigo;
  enabled: boolean;
  order: number;
}

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
  slide_config_json: SlideConfigItem[] | null;
  observacoes: string | null;
  status_editorial: ApresentacaoStatusEditorial;
  aprovado_por: string | null;
  aprovado_em: string | null;
  is_final: boolean;
  total_slides: number | null;
  slides_json: Record<string, unknown> | null;
  data_origem_json: Record<string, unknown> | null;
  gerado_por: string | null;
  gerado_em: string;
  created_at: string;
  updated_at: string;
  apresentacao_templates?: ApresentacaoTemplate;
}

export interface ApresentacaoComentario {
  id: string;
  geracao_id: string;
  slide_codigo: SlideCodigo;
  titulo: string | null;
  comentario_automatico: string | null;
  comentario_editado: string | null;
  comentario_status: ComentarioStatus;
  prioridade: number;
  tags_json: Record<string, unknown> | null;
  origem: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface ApresentacaoParametros {
  templateId: string;
  empresaId?: string | null;
  competenciaInicial: string;
  competenciaFinal: string;
  modoGeracao: ApresentacaoModoGeracao;
  slideConfig?: SlideConfigItem[];
  exigirRevisao?: boolean;
}

export interface SlideData {
  codigo: SlideCodigo;
  titulo: string;
  subtitulo?: string;
  dados: Record<string, unknown>;
  comentarioAutomatico: string;
  comentarioEditado?: string;
  indisponivel?: boolean;
}

export interface ApresentacaoDataBundle {
  periodo: { competenciaInicial: string; competenciaFinal: string };
  slides: Partial<Record<SlideCodigo, Record<string, unknown>>>;
  missingCritical?: SlideCodigo[];
}
