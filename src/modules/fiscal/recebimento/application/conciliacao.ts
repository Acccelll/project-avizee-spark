/**
 * Motor de conciliação de documentos recebidos vs pedidos/cadastros.
 * Sem side-effects em Compras/Estoque/Financeiro — apenas identifica
 * divergências e produz um relatório para o workflow de aprovação.
 */
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { FiscalEventBus } from '../../infrastructure/events/eventBus';
import type { IDocumentoRecebidoRepository, ICadastroLookup, IComprasIntegration } from './contracts';
import type { ConciliacaoResultado, Divergencia, ParseResult } from '../domain/entities';

export interface ConciliarInput {
  empresaId: string;
  correlationId: string;
  documentoRecebidoId: string;
  parsed: ParseResult;
  toleranciaValor?: number;   // ex.: 0.01
  toleranciaQuantidade?: number; // ex.: 0.001
}

export class ConciliacaoUseCase {
  constructor(private deps: {
    repository: IDocumentoRecebidoRepository;
    cadastros: ICadastroLookup;
    compras: IComprasIntegration;
    events: FiscalEventBus;
  }) {}

  async execute(input: ConciliarInput): Promise<Result<ConciliacaoResultado>> {
    const parsed = input.parsed;
    if (!parsed.cnpjEmit) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'documento sem CNPJ emitente'));
    }
    const fornecedor = await this.deps.cadastros.findFornecedorByCnpj(parsed.cnpjEmit);

    let pedido: { id: string; numero: string } | null = null;
    if (fornecedor && parsed.chaveAcesso && parsed.numeroDoc) {
      pedido = await this.deps.compras.buscarPedidoRelacionado(
        fornecedor.id, parsed.chaveAcesso, parsed.numeroDoc,
      );
    }

    const divergencias: Divergencia[] = [];
    const produtosDesconhecidos: string[] = [];

    for (const item of parsed.itens ?? []) {
      const prod = await this.deps.cadastros.findProdutoByCodigoOuEan(
        fornecedor?.id ?? null, item.cProd, item.cEAN,
      );
      if (!prod) produtosDesconhecidos.push(item.cProd);

      if (item.cfop && !(await this.deps.cadastros.validarCFOP(item.cfop))) {
        divergencias.push({
          tipo: 'cfop', itemNItem: item.nItem,
          encontrado: item.cfop, descricao: `CFOP ${item.cfop} não cadastrado`,
        });
      }
      if (item.ncm && !(await this.deps.cadastros.validarNCM(item.ncm))) {
        divergencias.push({
          tipo: 'ncm', itemNItem: item.nItem,
          encontrado: item.ncm, descricao: `NCM ${item.ncm} inválido`,
        });
      }
      const tolQ = input.toleranciaQuantidade ?? 0.001;
      if (item.qCom <= tolQ) {
        divergencias.push({
          tipo: 'quantidade', itemNItem: item.nItem,
          encontrado: item.qCom, descricao: `quantidade ≤ tolerância (${tolQ})`,
        });
      }
    }

    if (parsed.vTotal !== undefined && parsed.itens && parsed.itens.length > 0) {
      const soma = parsed.itens.reduce((s, i) => s + i.vProd, 0);
      const tol = input.toleranciaValor ?? 0.01;
      if (Math.abs(soma - parsed.vTotal) > tol) {
        divergencias.push({
          tipo: 'valor', esperado: parsed.vTotal, encontrado: Number(soma.toFixed(2)),
          descricao: `soma dos itens (${soma.toFixed(2)}) diverge do total (${parsed.vTotal})`,
        });
      }
    }

    const resultado: ConciliacaoResultado = {
      documentoId: input.documentoRecebidoId,
      fornecedorId: fornecedor?.id,
      pedidoCompraId: pedido?.id,
      divergencias,
      produtosDesconhecidos,
      fornecedorDesconhecido: !fornecedor,
      ok: !!fornecedor && divergencias.length === 0 && produtosDesconhecidos.length === 0,
    };

    await this.deps.events.emit('fiscal.recebimento.conciliacao.executada', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: input.documentoRecebidoId,
    });

    return ok(resultado);
  }
}