import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseUniversal,
  computeXmlHash,
  validarDocumentoRecebido,
  canTransition,
  transition,
  ImportarXmlUseCase,
  ImportarLoteUseCase,
  ConciliacaoUseCase,
  WorkflowRecebimentoUseCase,
  MonitorFiscal,
  type DocumentoRecebido,
  type IDocumentoRecebidoRepository,
  type IRecebimentoStorage,
  type ICadastroLookup,
  type IComprasIntegration,
  type IEstoqueIntegration,
  type IFinanceiroIntegration,
  type IRecebimentoAuditoria,
  type IMonitorRepositoryExt,
  type ParseResult,
} from '../index';
import { FiscalEventBus } from '../../infrastructure/events/eventBus';

const CHAVE = '35260712345678000199550010000000011000000015';

function nfeXml(overrides: {
  chave?: string; cnpjDest?: string; nItem?: number; vNF?: number;
} = {}): string {
  const chave = overrides.chave ?? CHAVE;
  const cnpjDest = overrides.cnpjDest ?? '98765432000188';
  const nItem = overrides.nItem ?? 1;
  const vNF = overrides.vNF ?? 100.0;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide><mod>55</mod><serie>1</serie><nNF>1</nNF>
        <dhEmi>2026-07-14T12:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>FORNEC LTDA</xNome>
        <enderEmit><UF>SP</UF></enderEmit></emit>
      <dest><CNPJ>${cnpjDest}</CNPJ><xNome>AVIZEE LTDA</xNome>
        <enderDest><UF>SP</UF></enderDest></dest>
      <det nItem="${nItem}">
        <prod><cProd>P1</cProd><cEAN>SEM GTIN</cEAN><xProd>PROD 1</xProd>
          <NCM>61099000</NCM><CFOP>5102</CFOP><uCom>UN</uCom>
          <qCom>1.0000</qCom><vUnCom>${vNF.toFixed(2)}</vUnCom>
          <vProd>${vNF.toFixed(2)}</vProd></prod>
      </det>
      <total><ICMSTot><vNF>${vNF.toFixed(2)}</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${chave}</chNFe><nProt>135260000000001</nProt></infProt></protNFe>
</nfeProc>`;
}

// -------- mocks in-memory ---------------------------------------------
class MemRepo implements IMonitorRepositoryExt {
  docs = new Map<string, DocumentoRecebido>();
  save = async (d: DocumentoRecebido) => { this.docs.set(d.id, { ...d }); };
  getById = async (id: string) => this.docs.get(id) ?? null;
  getByHash = async (_e: string, h: string) =>
    [...this.docs.values()].find((d) => d.hashXml === h) ?? null;
  getByChave = async (_e: string, c: string) =>
    [...this.docs.values()].find((d) => d.chaveAcesso === c) ?? null;
  updateStatus = async (id: string, s: DocumentoRecebido['status'], patch?: Partial<DocumentoRecebido>) => {
    const d = this.docs.get(id);
    if (d) this.docs.set(id, { ...d, ...patch, status: s });
  };
  appendMensagem = async (id: string, m: DocumentoRecebido['mensagens'][number]) => {
    const d = this.docs.get(id);
    if (d) { d.mensagens = [...d.mensagens, m]; this.docs.set(id, d); }
  };
  listRecentes = async (_e: string, n: number) => [...this.docs.values()].slice(-n);
}

const memStorage: IRecebimentoStorage = {
  putOriginal: async (_e, key) => `stored://original/${key}`,
  putProcessado: async (_e, key) => `stored://processado/${key}`,
  getOriginal: async () => null,
};
const memAudit: IRecebimentoAuditoria = { registrar: async () => {} };

// -------- suites ------------------------------------------------------
describe('Recebimento — parser universal', () => {
  it('identifica NF-e (nfeProc) e extrai chave/emit/dest/itens', () => {
    const r = parseUniversal(nfeXml());
    expect(r.ok).toBe(true);
    expect(r.data!.tipo).toBe('NFe');
    expect(r.data!.chaveAcesso).toBe(CHAVE);
    expect(r.data!.cnpjEmit).toBe('12345678000199');
    expect(r.data!.cnpjDest).toBe('98765432000188');
    expect(r.data!.itens?.length).toBe(1);
    expect(r.data!.vTotal).toBeCloseTo(100);
    expect(r.data!.protocoloAutorizacao).toBe('135260000000001');
  });

  it('rejeita raiz não registrada', () => {
    const r = parseUniversal('<?xml version="1.0"?><foo/>');
    expect(r.ok).toBe(false);
  });
});

describe('Recebimento — hash e dedup', () => {
  it('hash é estável para XML equivalente com whitespace diferente', async () => {
    const a = await computeXmlHash('<a><b>1</b></a>');
    const b = await computeXmlHash('<a>\n  <b>1</b>\n</a>');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Recebimento — validação', () => {
  it('rejeita destinatário diferente do CNPJ empresa (NF-e)', () => {
    const parsed = parseUniversal(nfeXml()).data!;
    const r = validarDocumentoRecebido(parsed, { cnpjEmpresa: '11111111000191' });
    expect(r.ok).toBe(false);
  });
  it('aceita quando CNPJ destinatário confere', () => {
    const parsed = parseUniversal(nfeXml()).data!;
    const r = validarDocumentoRecebido(parsed, { cnpjEmpresa: '98765432000188' });
    expect(r.ok).toBe(true);
  });
});

describe('Recebimento — máquina de estados', () => {
  it('permite recebido → em_validacao → validado → integrado', () => {
    expect(canTransition('recebido', 'em_validacao')).toBe(true);
    expect(canTransition('em_validacao', 'validado')).toBe(true);
    expect(canTransition('validado', 'integrado')).toBe(true);
  });
  it('bloqueia validado → recebido', () => {
    expect(transition('validado', 'recebido').ok).toBe(false);
  });
});

describe('Recebimento — ImportarXml + dedup', () => {
  let repo: MemRepo; let bus: FiscalEventBus; let uc: ImportarXmlUseCase;
  beforeEach(() => {
    repo = new MemRepo(); bus = new FiscalEventBus();
    uc = new ImportarXmlUseCase({ repository: repo, storage: memStorage, auditoria: memAudit, events: bus });
  });

  it('importa NF-e e persiste com status validado', async () => {
    const r = await uc.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'c-1',
      origem: 'upload_manual', xml: nfeXml(),
    });
    expect(r.ok).toBe(true);
    expect(r.data!.duplicado).toBe(false);
    expect(r.data!.documento.status).toBe('validado');
    expect(r.data!.documento.storageUrl).toBeDefined();
  });

  it('detecta duplicidade por hash na segunda importação', async () => {
    await uc.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'c-1',
      origem: 'upload_manual', xml: nfeXml(),
    });
    const r2 = await uc.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'c-2',
      origem: 'upload_manual', xml: nfeXml(),
    });
    expect(r2.ok).toBe(true);
    expect(r2.data!.duplicado).toBe(true);
  });
});

describe('Recebimento — ImportarLote', () => {
  it('processa lote com sucesso/duplicado/falha e emite finalizado', async () => {
    const repo = new MemRepo(); const bus = new FiscalEventBus();
    const single = new ImportarXmlUseCase({ repository: repo, storage: memStorage, auditoria: memAudit, events: bus });
    const lote = new ImportarLoteUseCase({ importar: single, events: bus });
    let finalizado = false;
    bus.on('fiscal.recebimento.lote.finalizado', () => { finalizado = true; });

    const r = await lote.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'lote-1',
      origem: 'upload_lote', concorrencia: 2,
      itens: [
        { nome: 'a.xml', xml: nfeXml({ chave: CHAVE }) },
        { nome: 'a-dup.xml', xml: nfeXml({ chave: CHAVE }) },
        { nome: 'invalid.xml', xml: '<foo/>' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.data!.total).toBe(3);
    expect(r.data!.sucesso).toBe(1);
    expect(r.data!.duplicados).toBe(1);
    expect(r.data!.falhas).toBe(1);
    expect(finalizado).toBe(true);
  });
});

describe('Recebimento — Conciliação + Workflow', () => {
  const parsed = (): ParseResult => parseUniversal(nfeXml()).data!;
  const cadastros: ICadastroLookup = {
    findFornecedorByCnpj: async (c) => c === '12345678000199' ? { id: 'forn-1', nome: 'F' } : null,
    findClienteByCnpj: async () => null,
    findTransportadoraByCnpj: async () => null,
    findProdutoByCodigoOuEan: async (_f, c) => c === 'P1' ? { id: 'prod-1', nome: 'PROD 1', codigo: 'P1' } : null,
    validarCFOP: async () => true,
    validarNCM: async () => true,
  };
  const compras: IComprasIntegration = {
    buscarPedidoRelacionado: async () => null,
    registrarRecebimento: async () => ({ compraId: 'compra-1' }),
  };
  const estoque: IEstoqueIntegration = {
    registrarEntrada: async () => ({ movimentosIds: ['m-1'] }),
  };
  const financeiro: IFinanceiroIntegration = {
    gerarTitulos: async () => ({ lancamentosIds: ['l-1'] }),
  };

  it('conciliação sem divergências marca ok=true', async () => {
    const repo = new MemRepo(); const bus = new FiscalEventBus();
    const uc = new ConciliacaoUseCase({ repository: repo, cadastros, compras, events: bus });
    const r = await uc.execute({
      empresaId: 'emp-1', correlationId: 'c-1', documentoRecebidoId: 'doc-1',
      parsed: parsed(),
    });
    expect(r.ok).toBe(true);
    expect(r.data!.fornecedorId).toBe('forn-1');
    expect(r.data!.ok).toBe(true);
    expect(r.data!.divergencias.length).toBe(0);
  });

  it('workflow aprovar integra compras/estoque/financeiro e transita para integrado', async () => {
    const repo = new MemRepo(); const bus = new FiscalEventBus();
    const imp = new ImportarXmlUseCase({ repository: repo, storage: memStorage, auditoria: memAudit, events: bus });
    const imported = await imp.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'c-imp',
      origem: 'upload_manual', xml: nfeXml(),
    });
    const docId = imported.data!.documento.id;
    const conc = new ConciliacaoUseCase({ repository: repo, cadastros, compras, events: bus });
    const c = await conc.execute({
      empresaId: 'emp-1', correlationId: 'c-conc', documentoRecebidoId: docId, parsed: parsed(),
    });
    const wf = new WorkflowRecebimentoUseCase({
      repository: repo, cadastros, compras, estoque, financeiro,
      auditoria: memAudit, events: bus,
    });
    const eventos: string[] = [];
    bus.on('fiscal.recebimento.integrado.compras', () => eventos.push('compras'));
    bus.on('fiscal.recebimento.integrado.estoque', () => eventos.push('estoque'));
    bus.on('fiscal.recebimento.integrado.financeiro', () => eventos.push('financeiro'));
    const ap = await wf.aprovar({
      empresaId: 'emp-1', correlationId: 'c-ap', documentoRecebidoId: docId,
      parsed: parsed(), conciliacao: c.data!,
    });
    expect(ap.ok).toBe(true);
    expect(ap.data!.compraId).toBe('compra-1');
    expect(eventos.sort()).toEqual(['compras', 'estoque', 'financeiro']);
    expect(repo.docs.get(docId)?.status).toBe('integrado');
  });

  it('workflow rejeitar bloqueia integração e transita para rejeitado', async () => {
    const repo = new MemRepo(); const bus = new FiscalEventBus();
    const imp = new ImportarXmlUseCase({ repository: repo, storage: memStorage, auditoria: memAudit, events: bus });
    const imported = await imp.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'c-imp',
      origem: 'upload_manual', xml: nfeXml(),
    });
    const wf = new WorkflowRecebimentoUseCase({
      repository: repo, cadastros, compras, estoque, financeiro,
      auditoria: memAudit, events: bus,
    });
    const rj = await wf.rejeitar({
      empresaId: 'emp-1', correlationId: 'c-rj', documentoRecebidoId: imported.data!.documento.id,
      motivo: 'divergência de valor',
    });
    expect(rj.ok).toBe(true);
    expect(repo.docs.get(imported.data!.documento.id)?.status).toBe('rejeitado');
  });
});

describe('Recebimento — MonitorFiscal', () => {
  it('agrega snapshot por status/origem', async () => {
    const repo = new MemRepo(); const bus = new FiscalEventBus();
    const uc = new ImportarXmlUseCase({ repository: repo, storage: memStorage, auditoria: memAudit, events: bus });
    await uc.execute({
      empresaId: 'emp-1', cnpjEmpresa: '98765432000188', correlationId: 'c-1',
      origem: 'upload_manual', xml: nfeXml(),
    });
    const monitor = new MonitorFiscal(repo);
    const snap = await monitor.snapshot('emp-1');
    expect(snap.total).toBe(1);
    expect(snap.porStatus.validado).toBe(1);
    expect(snap.porOrigem.upload_manual).toBe(1);
  });
});