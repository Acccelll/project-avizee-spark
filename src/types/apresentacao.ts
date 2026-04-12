export type ApresentacaoModoGeracao = 'dinamico' | 'fechado';

export interface ApresentacaoTemplate {
  id: string;
  nome: string;
  codigo: string;
  versao: string;
  ativo: boolean;
  descricao?: string;
  config_json?: Record<string, any>;
  arquivo_path?: string;
  created_at: string;
  updated_at: string;
}

export interface ApresentacaoGeracao {
  id: string;
  template_id: string;
  empresa_id?: string;
  competencia_inicial?: string;
  competencia_final?: string;
  modo_geracao: ApresentacaoModoGeracao;
  fechamento_id_inicial?: string;
  fechamento_id_final?: string;
  status: 'pendente' | 'gerando' | 'concluido' | 'erro';
  arquivo_path?: string;
  hash_geracao?: string;
  parametros_json?: Record<string, any>;
  observacoes?: string;
  gerado_por?: string;
  gerado_em: string;
  created_at: string;
  updated_at: string;
  apresentacao_templates?: {
    nome: string;
    versao: string;
  };
}

export interface ApresentacaoComentario {
  id: string;
  geracao_id: string;
  slide_codigo: string;
  titulo?: string;
  comentario_automatico?: string;
  comentario_editado?: string;
  origem?: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface ApresentacaoParametros {
  templateId: string;
  empresaId?: string;
  competenciaInicial: string;
  competenciaFinal: string;
  modoGeracao: ApresentacaoModoGeracao;
  slidesSelecionados: string[];
}

export interface ApresentacaoData {
  highlights: any[];
  faturamento: any[];
  despesas: any[];
  rolCaixa: any[];
  receitaVsDespesa: any[];
  fopag: any[];
  fluxoCaixa: any[];
  lucroProdutoCliente: any[];
  variacaoEstoque: any[];
  vendaEstado: any[];
  redesSociais: any[];
}
