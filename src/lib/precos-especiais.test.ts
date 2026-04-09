import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isRegraVigente,
  buscarRegraAplicavel,
  aplicarPrecoEspecial,
  aplicarPrecosEspeciaisEmLote,
  type RegraPrecoEspecial,
} from '@/lib/precos-especiais';

// ── isRegraVigente ────────────────────────────────────────────────────────────

describe('isRegraVigente', () => {
  afterEach(() => vi.useRealTimers());

  const hoje = new Date('2026-03-15T12:00:00');

  it('retorna true quando não há restrição de vigência', () => {
    expect(isRegraVigente(null, null, hoje)).toBe(true);
    expect(isRegraVigente(undefined, undefined, hoje)).toBe(true);
  });

  it('retorna true quando hoje está dentro do período de vigência', () => {
    expect(isRegraVigente('2026-01-01', '2026-12-31', hoje)).toBe(true);
  });

  it('retorna true no primeiro dia da vigência', () => {
    expect(isRegraVigente('2026-03-15', '2026-12-31', hoje)).toBe(true);
  });

  it('retorna true no último dia da vigência', () => {
    // vigência_fim é inclusivo (até 23:59:59)
    expect(isRegraVigente('2026-01-01', '2026-03-15', hoje)).toBe(true);
  });

  it('retorna false quando vigência ainda não começou', () => {
    expect(isRegraVigente('2026-03-16', '2026-12-31', hoje)).toBe(false);
  });

  it('retorna false quando vigência já terminou', () => {
    expect(isRegraVigente('2026-01-01', '2026-03-14', hoje)).toBe(false);
  });

  it('retorna true sem data de fim (vigência aberta)', () => {
    expect(isRegraVigente('2026-01-01', null, hoje)).toBe(true);
  });

  it('retorna false quando data de início é posterior a hoje e sem fim', () => {
    expect(isRegraVigente('2026-04-01', null, hoje)).toBe(false);
  });
});

// ── buscarRegraAplicavel ──────────────────────────────────────────────────────

describe('buscarRegraAplicavel', () => {
  const hoje = new Date('2026-03-15T12:00:00');

  const regras: RegraPrecoEspecial[] = [
    {
      produto_id: 'prod-1',
      preco_especial: 99.9,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-12-31',
    },
    {
      produto_id: 'prod-2',
      desconto_percentual: 10,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-12-31',
    },
    {
      produto_id: 'prod-3',
      preco_especial: 50,
      vigencia_inicio: '2027-01-01', // não vigente
      vigencia_fim: null,
    },
  ];

  it('encontra a regra vigente para um produto', () => {
    const regra = buscarRegraAplicavel(regras, 'prod-1', hoje);
    expect(regra).toBeDefined();
    expect(regra?.produto_id).toBe('prod-1');
  });

  it('retorna undefined para produto sem regra', () => {
    expect(buscarRegraAplicavel(regras, 'prod-sem-regra', hoje)).toBeUndefined();
  });

  it('retorna undefined quando a regra existe mas não está vigente', () => {
    expect(buscarRegraAplicavel(regras, 'prod-3', hoje)).toBeUndefined();
  });

  it('retorna undefined quando a lista de regras está vazia', () => {
    expect(buscarRegraAplicavel([], 'prod-1', hoje)).toBeUndefined();
  });
});

// ── aplicarPrecoEspecial ──────────────────────────────────────────────────────

describe('aplicarPrecoEspecial', () => {
  it('retorna o preço fixo quando preco_especial é definido', () => {
    const regra: RegraPrecoEspecial = {
      produto_id: 'p1',
      preco_especial: 149.99,
    };
    expect(aplicarPrecoEspecial(200, regra)).toBe(149.99);
  });

  it('aplica desconto percentual sobre o preço base', () => {
    const regra: RegraPrecoEspecial = {
      produto_id: 'p1',
      desconto_percentual: 10,
    };
    // 200 × (1 - 10/100) = 180
    expect(aplicarPrecoEspecial(200, regra)).toBe(180);
  });

  it('preço fixo tem prioridade sobre desconto percentual', () => {
    const regra: RegraPrecoEspecial = {
      produto_id: 'p1',
      preco_especial: 150,
      desconto_percentual: 10,
    };
    expect(aplicarPrecoEspecial(200, regra)).toBe(150);
  });

  it('retorna o preço base quando não há regra aplicável (preço e desconto zero)', () => {
    const regra: RegraPrecoEspecial = {
      produto_id: 'p1',
      preco_especial: 0,
      desconto_percentual: 0,
    };
    expect(aplicarPrecoEspecial(200, regra)).toBe(200);
  });

  it('retorna o preço base quando regra não tem preço nem desconto', () => {
    const regra: RegraPrecoEspecial = {
      produto_id: 'p1',
    };
    expect(aplicarPrecoEspecial(200, regra)).toBe(200);
  });

  it('arredonda desconto percentual para 4 casas decimais', () => {
    // 100 × (1 - 33.33/100) = 66.67
    const regra: RegraPrecoEspecial = {
      produto_id: 'p1',
      desconto_percentual: 33.33,
    };
    expect(aplicarPrecoEspecial(100, regra)).toBeCloseTo(66.67, 2);
  });
});

// ── aplicarPrecosEspeciaisEmLote ──────────────────────────────────────────────

describe('aplicarPrecosEspeciaisEmLote', () => {
  const hoje = new Date('2026-03-15T12:00:00');

  const regrasVigentes: RegraPrecoEspecial[] = [
    {
      produto_id: 'prod-1',
      preco_especial: 80,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-12-31',
    },
    {
      produto_id: 'prod-2',
      desconto_percentual: 20,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-12-31',
    },
  ];

  const itens = [
    { produto_id: 'prod-1', valor_unitario: 100, quantidade: 2, valor_total: 200 },
    { produto_id: 'prod-2', valor_unitario: 50, quantidade: 3, valor_total: 150 },
    { produto_id: 'prod-sem-regra', valor_unitario: 30, quantidade: 5, valor_total: 150 },
  ];

  it('aplica preço fixo e desconto percentual corretamente em lote', () => {
    const { itens: atualizados } = aplicarPrecosEspeciaisEmLote(itens, regrasVigentes, hoje);

    expect(atualizados[0].valor_unitario).toBe(80);
    expect(atualizados[0].valor_total).toBe(160); // 80 × 2

    expect(atualizados[1].valor_unitario).toBe(40); // 50 × 0.80
    expect(atualizados[1].valor_total).toBe(120); // 40 × 3
  });

  it('não altera itens sem regra de preço', () => {
    const { itens: atualizados } = aplicarPrecosEspeciaisEmLote(itens, regrasVigentes, hoje);

    expect(atualizados[2].valor_unitario).toBe(30);
    expect(atualizados[2].valor_total).toBe(150);
  });

  it('registra os produtos alterados na lista "alterados"', () => {
    const { alterados } = aplicarPrecosEspeciaisEmLote(itens, regrasVigentes, hoje);

    expect(alterados).toContain('prod-1');
    expect(alterados).toContain('prod-2');
    expect(alterados).not.toContain('prod-sem-regra');
  });

  it('retorna itens inalterados quando lista de regras está vazia', () => {
    const { itens: atualizados, alterados } = aplicarPrecosEspeciaisEmLote(itens, [], hoje);

    expect(atualizados).toEqual(itens);
    expect(alterados).toHaveLength(0);
  });

  it('não altera itens quando regras estão fora da vigência', () => {
    const regrasVencidas: RegraPrecoEspecial[] = [
      {
        produto_id: 'prod-1',
        preco_especial: 1,
        vigencia_inicio: '2020-01-01',
        vigencia_fim: '2020-12-31', // expirada
      },
    ];
    const { itens: atualizados, alterados } = aplicarPrecosEspeciaisEmLote(
      itens,
      regrasVencidas,
      hoje,
    );

    expect(atualizados[0].valor_unitario).toBe(100);
    expect(alterados).toHaveLength(0);
  });

  it('é imutável — não modifica o array de entrada', () => {
    const itensCopia = JSON.parse(JSON.stringify(itens));
    aplicarPrecosEspeciaisEmLote(itens, regrasVigentes, hoje);
    expect(itens).toEqual(itensCopia);
  });
});
