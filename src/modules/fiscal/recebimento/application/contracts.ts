/**
 * Portas do módulo de Recebimento Fiscal. As implementações concretas
 * (Supabase, Storage, RPCs Compras/Estoque/Financeiro) ficam para
 * adaptadores; o núcleo permanece agnóstico e testável.
 */
import type { DocumentoRecebido, ParseResult } from '../domain/entities';

export interface IDocumentoRecebidoRepository {
  save(doc: DocumentoRecebido): Promise<void>;
  getById(id: string): Promise<DocumentoRecebido | null>;
  getByHash(empresaId: string, hash: string): Promise<DocumentoRecebido | null>;
  getByChave(empresaId: string, chave: string): Promise<DocumentoRecebido | null>;
  updateStatus(id: string, status: DocumentoRecebido['status'], patch?: Partial<DocumentoRecebido>): Promise<void>;
  appendMensagem(id: string, msg: DocumentoRecebido['mensagens'][number]): Promise<void>;
}

export interface IRecebimentoStorage {
  putOriginal(empresaId: string, chaveOuHash: string, xml: string): Promise<string>;
  putProcessado(empresaId: string, chaveOuHash: string, xml: string): Promise<string>;
  getOriginal(url: string): Promise<string | null>;
}

export interface ICadastroLookup {
  findFornecedorByCnpj(cnpj: string): Promise<{ id: string; nome: string } | null>;
  findClienteByCnpj(cnpj: string): Promise<{ id: string; nome: string } | null>;
  findTransportadoraByCnpj(cnpj: string): Promise<{ id: string; nome: string } | null>;
  findProdutoByCodigoOuEan(fornecedorId: string | null, codigo: string, ean?: string):
    Promise<{ id: string; nome: string; codigo: string } | null>;
  validarCFOP(cfop: string): Promise<boolean>;
  validarNCM(ncm: string): Promise<boolean>;
}

export interface IComprasIntegration {
  buscarPedidoRelacionado(fornecedorId: string, chaveAcesso: string, numeroNF: string):
    Promise<{ id: string; numero: string } | null>;
  registrarRecebimento(input: {
    empresaId: string; fornecedorId: string; documentoRecebidoId: string;
    pedidoCompraId?: string; parsed: ParseResult;
  }): Promise<{ compraId: string }>;
}

export interface IEstoqueIntegration {
  registrarEntrada(input: {
    empresaId: string; documentoRecebidoId: string; compraId?: string;
    itens: Array<{ produtoId: string; quantidade: number; valorUnitario: number; loteId?: string }>;
  }): Promise<{ movimentosIds: string[] }>;
}

export interface IFinanceiroIntegration {
  gerarTitulos(input: {
    empresaId: string; documentoRecebidoId: string; fornecedorId: string;
    compraId?: string; parsed: ParseResult;
  }): Promise<{ lancamentosIds: string[] }>;
}

export interface IRecebimentoAuditoria {
  registrar(entry: {
    empresaId: string;
    documentoRecebidoId: string;
    correlationId: string;
    operacao: string;
    ator?: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}