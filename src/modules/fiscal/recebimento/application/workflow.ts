/**
 * Workflow de aprovação/rejeição do documento recebido. Orquestra as
 * transições de estado e delega a integração para as portas
 * IComprasIntegration/IEstoqueIntegration/IFinanceiroIntegration.
 */
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { FiscalEventBus } from '../../infrastructure/events/eventBus';
import type {
  IDocumentoRecebidoRepository,
  IComprasIntegration,
  IEstoqueIntegration,
  IFinanceiroIntegration,
  IRecebimentoAuditoria,
  ICadastroLookup,
} from './contracts';
import type { ConciliacaoResultado, ParseResult } from '../domain/entities';
import { transition, canTransition } from '../domain/stateMachine';

export interface AprovarInput {
  empresaId: string;
  correlationId: string;
  documentoRecebidoId: string;
  parsed: ParseResult;
  conciliacao: ConciliacaoResultado;
  ator?: string;
}

export interface RejeitarInput {
  empresaId: string;
  correlationId: string;
  documentoRecebidoId: string;
  motivo: string;
  ator?: string;
}

export class WorkflowRecebimentoUseCase {
  constructor(private deps: {
    repository: IDocumentoRecebidoRepository;
    cadastros: ICadastroLookup;
    compras: IComprasIntegration;
    estoque: IEstoqueIntegration;
    financeiro: IFinanceiroIntegration;
    auditoria: IRecebimentoAuditoria;
    events: FiscalEventBus;
  }) {}

  async marcarPendenteAprovacao(input: {
    empresaId: string; correlationId: string; documentoRecebidoId: string; motivo: string;
  }): Promise<Result<true>> {
    const doc = await this.deps.repository.getById(input.documentoRecebidoId);
    if (!doc) return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'documento não encontrado'));
    if (!canTransition(doc.status, 'pendente_aprovacao')) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, `estado ${doc.status} não permite pendente_aprovacao`));
    }
    await this.deps.repository.updateStatus(doc.id, 'pendente_aprovacao');
    await this.deps.repository.appendMensagem(doc.id, {
      nivel: 'warn', codigo: 'workflow.pendente', descricao: input.motivo,
      timestamp: new Date().toISOString(),
    });
    await this.deps.events.emit('fiscal.recebimento.pendente_aprovacao', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id, chave: doc.chaveAcesso,
    });
    return ok(true as const);
  }

  async aprovar(input: AprovarInput): Promise<Result<{ compraId?: string }>> {
    const doc = await this.deps.repository.getById(input.documentoRecebidoId);
    if (!doc) return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'documento não encontrado'));
    if (!canTransition(doc.status, 'integrado')) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, `estado ${doc.status} não permite integração`));
    }
    if (input.conciliacao.fornecedorDesconhecido || !input.conciliacao.fornecedorId) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'fornecedor não cadastrado — cadastro assistido obrigatório'));
    }

    // Compras
    const rc = await this.deps.compras.registrarRecebimento({
      empresaId: input.empresaId,
      fornecedorId: input.conciliacao.fornecedorId,
      documentoRecebidoId: doc.id,
      pedidoCompraId: input.conciliacao.pedidoCompraId,
      parsed: input.parsed,
    });
    await this.deps.events.emit('fiscal.recebimento.integrado.compras', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id, chave: doc.chaveAcesso,
    });

    // Estoque — apenas itens com produto cadastrado
    const itensEstoque: Array<{ produtoId: string; quantidade: number; valorUnitario: number }> = [];
    for (const it of input.parsed.itens ?? []) {
      const p = await this.deps.cadastros.findProdutoByCodigoOuEan(
        input.conciliacao.fornecedorId, it.cProd, it.cEAN,
      );
      if (p) itensEstoque.push({ produtoId: p.id, quantidade: it.qCom, valorUnitario: it.vUnCom });
    }
    if (itensEstoque.length > 0) {
      await this.deps.estoque.registrarEntrada({
        empresaId: input.empresaId,
        documentoRecebidoId: doc.id,
        compraId: rc.compraId,
        itens: itensEstoque,
      });
      await this.deps.events.emit('fiscal.recebimento.integrado.estoque', {
        correlationId: input.correlationId, empresaId: input.empresaId,
        documentoRecebidoId: doc.id,
      });
    }

    // Financeiro
    await this.deps.financeiro.gerarTitulos({
      empresaId: input.empresaId,
      documentoRecebidoId: doc.id,
      fornecedorId: input.conciliacao.fornecedorId,
      compraId: rc.compraId,
      parsed: input.parsed,
    });
    await this.deps.events.emit('fiscal.recebimento.integrado.financeiro', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id,
    });

    await this.deps.repository.updateStatus(doc.id, 'integrado');
    await this.deps.auditoria.registrar({
      empresaId: input.empresaId,
      documentoRecebidoId: doc.id,
      correlationId: input.correlationId,
      operacao: 'recebimento.aprovado',
      ator: input.ator,
      payload: { compraId: rc.compraId, itensEstoque: itensEstoque.length },
    });
    await this.deps.events.emit('fiscal.recebimento.aprovado', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id, chave: doc.chaveAcesso,
    });
    return ok({ compraId: rc.compraId });
  }

  async rejeitar(input: RejeitarInput): Promise<Result<true>> {
    const doc = await this.deps.repository.getById(input.documentoRecebidoId);
    if (!doc) return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'documento não encontrado'));
    const t = transition(doc.status, 'rejeitado');
    if (!t.ok) return fail(t.error!);
    await this.deps.repository.updateStatus(doc.id, 'rejeitado');
    await this.deps.repository.appendMensagem(doc.id, {
      nivel: 'error', codigo: 'workflow.rejeitado', descricao: input.motivo,
      timestamp: new Date().toISOString(),
    });
    await this.deps.auditoria.registrar({
      empresaId: input.empresaId, documentoRecebidoId: doc.id,
      correlationId: input.correlationId, operacao: 'recebimento.rejeitado',
      ator: input.ator, payload: { motivo: input.motivo },
    });
    await this.deps.events.emit('fiscal.recebimento.rejeitado', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id, chave: doc.chaveAcesso,
    });
    return ok(true as const);
  }

  async reprocessar(input: { empresaId: string; correlationId: string; documentoRecebidoId: string; ator?: string }): Promise<Result<true>> {
    const doc = await this.deps.repository.getById(input.documentoRecebidoId);
    if (!doc) return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'documento não encontrado'));
    const t = transition(doc.status, 'reprocessando');
    if (!t.ok) return fail(t.error!);
    await this.deps.repository.updateStatus(doc.id, 'reprocessando');
    await this.deps.auditoria.registrar({
      empresaId: input.empresaId, documentoRecebidoId: doc.id,
      correlationId: input.correlationId, operacao: 'recebimento.reprocessado', ator: input.ator,
    });
    await this.deps.events.emit('fiscal.recebimento.reprocessado', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id, chave: doc.chaveAcesso,
    });
    return ok(true as const);
  }
}