/**
 * Etapa 10 — Camada operacional do Framework Fiscal.
 * Contratos e tipos consumidos por UI, monitores e serviços administrativos.
 */

export type SefazAmbiente = 'producao' | 'homologacao';
export type SefazStatus = 'disponivel' | 'lento' | 'indisponivel' | 'desconhecido';

export interface SefazServicoSnapshot {
  uf: string;
  ambiente: SefazAmbiente;
  servico: string; // 'NfeAutorizacao' | 'NfeRetAutorizacao' | 'NfeConsulta' | 'NfeStatusServico' | ...
  status: SefazStatus;
  latenciaMs?: number;
  ultimaVerificacao: string;
  falhasRecentes: number;
  circuitBreaker: 'closed' | 'open' | 'half_open';
}

export interface FilaSnapshot {
  nome: string;
  pendentes: number;
  emProcessamento: number;
  falhas24h: number;
  ultimaExecucao?: string;
  tempoMedioMs?: number;
}

export interface ProcessamentoJob {
  id: string;
  fila: string;
  tipo: string;
  status: 'pendente' | 'processando' | 'concluido' | 'falhou' | 'reprocessando';
  criadoEm: string;
  atualizadoEm: string;
  tentativas: number;
  ultimoErro?: string;
  payloadResumo?: string;
}

export type PendenciaTipo =
  | 'nfe_rejeitada'
  | 'inconsistencia_fiscal'
  | 'falha_integracao'
  | 'erro_tributario'
  | 'cadastro_incompleto'
  | 'xml_invalido'
  | 'falha_assinatura'
  | 'certificado_expirado';

export type PendenciaSeveridade = 'baixa' | 'media' | 'alta' | 'critica';

export interface PendenciaFiscal {
  id: string;
  empresaId: string;
  tipo: PendenciaTipo;
  severidade: PendenciaSeveridade;
  titulo: string;
  descricao: string;
  documentoId?: string;
  criadoEm: string;
  resolvidoEm?: string;
  acaoSugerida?: string;
}

export type NotificacaoCategoria =
  | 'certificado'
  | 'nfe'
  | 'sefaz'
  | 'apuracao'
  | 'processamento'
  | 'inconsistencia';

export interface NotificacaoFiscal {
  id: string;
  empresaId: string;
  categoria: NotificacaoCategoria;
  titulo: string;
  mensagem: string;
  criadoEm: string;
  lidaEm?: string;
  severidade: 'info' | 'aviso' | 'critica';
  canais: Array<'app' | 'email' | 'push' | 'webhook'>;
  dados?: Record<string, unknown>;
}

export interface CentralFiscalResumo {
  emitidos: number;
  recebidos: number;
  autorizadas: number;
  rejeitadas: number;
  canceladas: number;
  distDFePendentes: number;
  inconsistencias: number;
  processamentoPendente: number;
  atualizadoEm: string;
}

export interface CertificadoInfo {
  id: string;
  empresaId: string;
  cnpj: string;
  titular: string;
  ambiente: SefazAmbiente;
  validoAte: string;
  ativo: boolean;
  serial?: string;
  observacoes?: string;
}

export interface BuscaGlobalItem {
  tipo: 'chave' | 'cnpj' | 'cpf' | 'fornecedor' | 'cliente' | 'protocolo' | 'evento' | 'nsu' | 'numero' | 'serie' | 'xml';
  valor: string;
  descricao: string;
  href?: string;
}

export interface RelatorioProntidao {
  geradoEm: string;
  concluidos: string[];
  pendentes: string[];
  riscos: string[];
  recomendacoes: string[];
  checklist: Array<{ item: string; ok: boolean }>;
}
