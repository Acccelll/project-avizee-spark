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
  abasSelecionadas: string[];
}
