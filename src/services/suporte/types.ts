/**
 * Tipos do domínio de Ajuda/Suporte/Chamados.
 *
 * O schema (tabelas, enums, RPCs) já existe em produção — foi construído fora
 * do fluxo normal de migrations deste repositório (ver
 * ERP_AVIZEE_Especificacao_Ajuda_Suporte_Chamados, Parte III). Este arquivo é
 * a camada de tipos usada pelo frontend, derivada do `Database` gerado.
 */
import type { Database } from "@/integrations/supabase/types";
import type { TableRow } from "@/types/domain";

export type SuporteChamado = TableRow<"suporte_chamados">;
export type SuporteDiagnostico = TableRow<"suporte_diagnosticos">;
export type SuporteEvento = TableRow<"suporte_eventos">;
export type SuporteAnexo = TableRow<"suporte_anexos">;

export type SuporteTipo = Database["public"]["Enums"]["suporte_tipo"];
export type SuporteImpacto = Database["public"]["Enums"]["suporte_impacto"];
export type SuporteAbrangencia = Database["public"]["Enums"]["suporte_abrangencia"];
export type SuporteFrequencia = Database["public"]["Enums"]["suporte_frequencia"];
export type SuporteStatus = Database["public"]["Enums"]["suporte_status"];
export type SuportePrioridade = Database["public"]["Enums"]["suporte_prioridade"];
export type SuporteCausa = Database["public"]["Enums"]["suporte_causa"];
export type SuporteDecisaoSugestao = Database["public"]["Enums"]["suporte_decisao_sugestao"];
export type SuporteEventoTipo = Database["public"]["Enums"]["suporte_evento_tipo"];

export type SuporteVisibilidade = "publico" | "interno";

/** Rótulos humanizados — seção 6 e 15 da especificação. */
export const SUPORTE_TIPO_LABELS: Record<SuporteTipo, string> = {
  bug: "Bug / erro",
  problema_operacional: "Problema operacional",
  duvida: "Dúvida",
  sugestao: "Sugestão de melhoria",
};

export const SUPORTE_IMPACTO_LABELS: Record<SuporteImpacto, string> = {
  incomodo: "Baixo — consigo trabalhar normalmente",
  atrapalha_trabalho: "Médio — atrapalha, mas existe alternativa",
  nao_consigo_concluir: "Alto — não consigo concluir a tarefa",
  indisponivel: "Crítico — operação essencial está indisponível",
};

export const SUPORTE_ABRANGENCIA_LABELS: Record<SuporteAbrangencia, string> = {
  so_eu: "Só eu",
  mais_pessoas: "Mais pessoas",
  nao_sei: "Não sei",
};

export const SUPORTE_FREQUENCIA_LABELS: Record<SuporteFrequencia, string> = {
  uma_vez: "Uma vez",
  mais_de_uma_vez: "Mais de uma vez",
  sempre_que_tento: "Sempre que tento",
  nao_sei: "Não sei",
};

export const SUPORTE_STATUS_LABELS: Record<SuporteStatus, string> = {
  aberto: "Aberto",
  em_triagem: "Em triagem",
  em_andamento: "Em andamento",
  aguardando_usuario: "Aguardando usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

export const SUPORTE_PRIORIDADE_LABELS: Record<SuportePrioridade, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

export const SUPORTE_CAUSA_LABELS: Record<SuporteCausa, string> = {
  bug_corrigido: "Bug corrigido",
  configuracao: "Configuração",
  permissao: "Permissão",
  dado_inconsistente: "Dado inconsistente",
  uso_incorreto: "Uso incorreto",
  duplicado: "Duplicado",
  melhoria_implementada: "Melhoria implementada",
  nao_reproduzido: "Não reproduzido",
  outro: "Outro",
};

/** Payload de diagnóstico técnico coletado automaticamente (seção 9/13). */
export interface SuporteDiagnosticoPayload {
  url_relativa?: string;
  versao_build?: string;
  ambiente?: string;
  navegador?: string;
  sistema_operacional?: string;
  viewport?: string;
  idioma?: string;
  conectividade?: string;
  contexto_tela?: Record<string, unknown>;
  erro_codigo?: string;
  erro_operacao?: string;
  erro_mensagem_amigavel?: string;
  erro_correlation_id?: string;
  erro_http_status?: number;
  erro_stack_trace?: string;
  erros_recentes?: unknown[];
  requisicoes_rede?: unknown[];
}

/** Subconjunto amigável retornado por `obter_diagnostico_suporte` (campos admin-only vêm null para não-admin). */
export interface SuporteDiagnosticoView {
  url_relativa: string | null;
  versao_build: string | null;
  ambiente: string | null;
  navegador: string | null;
  sistema_operacional: string | null;
  viewport: string | null;
  idioma: string | null;
  conectividade: string | null;
  contexto_tela: unknown;
  erro_mensagem_amigavel: string | null;
  erro_codigo: string | null;
  erro_operacao: string | null;
  erro_correlation_id: string | null;
  erro_http_status: number | null;
  erro_stack_trace: string | null;
  erros_recentes: unknown;
  requisicoes_rede: unknown;
}

export interface AbrirChamadoInput {
  tipo: SuporteTipo;
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto;
  abrangencia: SuporteAbrangencia;
  frequencia: SuporteFrequencia;
  rota: string;
  registroRelacionadoTipo?: string;
  registroRelacionadoId?: string;
  diagnostico?: SuporteDiagnosticoPayload;
}
