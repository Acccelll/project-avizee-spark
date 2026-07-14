/**
 * Etapa 13 — Fiscal Platform: contratos genéricos, independentes de documento.
 * Todo documento fiscal (NF-e, NFC-e, CT-e, MDF-e, BP-e, NF3-e, NFS-e, futuros)
 * é modelado como um plugin conforme estes contratos.
 */

export type DocumentoFiscalCodigo = string; // 'nfe','nfce','cte','mdfe','bpe','nf3e','nfse','custom-*'

export type Capacidade =
  | 'emissao'
  | 'autorizacao'
  | 'cancelamento'
  | 'consulta'
  | 'inutilizacao'
  | 'cce'
  | 'manifestacao'
  | 'distdfe'
  | 'sincronizacao'
  | 'encerramento';

export interface DescritorLayout {
  chave: string;              // ex.: 'nfe.autorizacao'
  versao: string;             // ex.: '4.00'
  documento: DocumentoFiscalCodigo;
  ambiente?: 'homologacao' | 'producao' | 'ambos';
  descricao?: string;
}

export interface DescritorServico {
  nome: string;               // ex.: 'authorize', 'query', 'cancel'
  versao: string;
  documento: DocumentoFiscalCodigo;
  capacidades: Capacidade[];
  dependencias?: string[];
  contrato: string;           // identificador do contrato (nome da interface)
  handler: (...args: unknown[]) => Promise<unknown>;
}

export interface DescritorValidador<TInput = unknown> {
  id: string;
  documento: DocumentoFiscalCodigo;
  descricao?: string;
  run: (input: TInput) => Promise<ResultadoValidacao> | ResultadoValidacao;
}

export interface ResultadoValidacao {
  ok: boolean;
  erros: Array<{ codigo: string; mensagem: string; campo?: string }>;
  avisos?: Array<{ codigo: string; mensagem: string; campo?: string }>;
}

export interface DescritorBuilder<TInput = unknown, TOutput = unknown> {
  id: string;
  documento: DocumentoFiscalCodigo;
  formato: 'xml' | 'json' | 'protobuf' | 'texto' | 'outro';
  build: (input: TInput) => Promise<TOutput> | TOutput;
  parse?: (raw: string | Uint8Array) => Promise<TInput> | TInput;
}

export interface DescritorEvento {
  nome: string;               // ex.: 'fiscal.nfe.autorizada'
  documento?: DocumentoFiscalCodigo;
  categoria: 'fiscal' | 'interno' | 'integracao' | 'auditoria';
  descricao?: string;
}

export interface DescritorIntegracao {
  id: string;                 // ex.: 'sefaz.sp.nfe.autorizacao'
  tipo: 'sefaz' | 'prefeitura' | 'receita_federal' | 'ws_estadual' | 'ws_municipal' | 'terceiro';
  documento?: DocumentoFiscalCodigo;
  endpoint?: string;
  adapter: () => IntegracaoAdapter;
}

export interface IntegracaoAdapter {
  invoke(operacao: string, payload: unknown): Promise<unknown>;
}

export interface DescritorWorkflow {
  id: string;                 // ex.: 'nfe.emissao'
  documento: DocumentoFiscalCodigo;
  capacidade: Capacidade;
  passos: PassoWorkflow[];
}

export interface ContextoWorkflow {
  documento: DocumentoFiscalCodigo;
  correlationId: string;
  data: Record<string, unknown>;
}

export interface PassoWorkflow {
  id: string;
  execute: (ctx: ContextoWorkflow) => Promise<void>;
  compensate?: (ctx: ContextoWorkflow) => Promise<void>;
}

export interface PluginDocumentoFiscal {
  codigo: DocumentoFiscalCodigo;
  nome: string;
  versao: string;
  capacidades: Capacidade[];
  dependencias?: DocumentoFiscalCodigo[];
  layouts?: DescritorLayout[];
  servicos?: DescritorServico[];
  validadores?: DescritorValidador[];
  builders?: DescritorBuilder[];
  eventos?: DescritorEvento[];
  integracoes?: DescritorIntegracao[];
  workflows?: DescritorWorkflow[];
  onRegister?: (platform: FiscalPlatformAPI) => void | Promise<void>;
}

export interface FiscalPlatformAPI {
  documentos: import('./registries/documentoRegistry').DocumentoRegistry;
  layouts: import('./registries/layoutRegistry').PlatformLayoutRegistry;
  servicos: import('./registries/servicoRegistry').ServicoRegistry;
  validadores: import('./registries/validadorRegistry').ValidadorRegistry;
  builders: import('./registries/builderRegistry').BuilderRegistry;
  eventos: import('./registries/eventoRegistry').EventoRegistry;
  integracoes: import('./registries/integracaoRegistry').IntegracaoRegistry;
  workflows: import('./registries/workflowRegistry').WorkflowRegistry;
}
