/**
 * Utilitários de matching de produtos para migração com preservação histórica.
 *
 * `normalizarDescricao` deve produzir EXATAMENTE o mesmo resultado que a função
 * SQL `public.normalizar_descricao(text)`:
 *   - lowercase
 *   - remoção de acentos (NFD + remove diacríticos)
 *   - colapsa whitespace múltiplo em um único espaço
 *   - trim final
 */
export function normalizarDescricao(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type MatchStatus = "vinculado" | "nao_vinculado" | "manual" | "duvidoso";
export type MatchTipo = "exato_codigo" | "exato_descricao" | "manual" | "aproximado" | "nao_vinculado";

export interface PreviewMatchCounts {
  vinculado: number;
  duvidoso: number;
  nao_vinculado: number;
  criar_descontinuado: number;
}

export interface RelatorioMigracaoFaturamento {
  total_itens: number;
  vinculados: number;
  duvidosos: number;
  nao_vinculados: number;
  pct_vinculados: number;
  pct_duvidosos: number;
  pct_nao_vinculados: number;
  produtos_descontinuados_criados: number;
  amostra_nao_vinculados: Array<{ codigo: string | null; descricao: string | null; qtd: number }>;
  amostra_descontinuados: Array<{ produto_id: string; codigo: string | null; descricao: string | null; descontinuado_em: string | null }>;
}

/**
 * Classifica um item do faturamento contra o catálogo atual + tabela ponte,
 * sem persistir nada. Espelha a lógica em 3 níveis da RPC consolidar_lote_faturamento
 * para o preview.
 */
export interface ProdutoLookup {
  id: string;
  codigo_interno: string | null;
  codigo_legado: string | null;
  nome: string | null;
  ativo: boolean;
}

export interface IdentificadorLegacyLookup {
  produto_id: string;
  codigo_legacy: string | null;
  descricao_normalizada: string | null;
}

export function classificarMatchPreview(
  codigoLegacy: string | null | undefined,
  descricaoLegacy: string | null | undefined,
  produtos: ProdutoLookup[],
  identificadores: IdentificadorLegacyLookup[],
): { status: MatchStatus; tipo: MatchTipo; produtoId: string | null; criariaDescontinuado: boolean } {
  const cod = (codigoLegacy ?? "").toString().trim();
  const descNorm = normalizarDescricao(descricaoLegacy);

  // 1. Exato por código (codigo_legado ou codigo_interno)
  if (cod) {
    const porCodigo = produtos.filter(
      (p) => (p.codigo_legado && p.codigo_legado === cod) || (p.codigo_interno && p.codigo_interno === cod),
    );
    const distintos = new Set(porCodigo.map((p) => p.id));
    if (distintos.size === 1) {
      return { status: "vinculado", tipo: "exato_codigo", produtoId: porCodigo[0].id, criariaDescontinuado: false };
    }
    if (distintos.size > 1) {
      return { status: "duvidoso", tipo: "aproximado", produtoId: null, criariaDescontinuado: false };
    }

    // 2. Tabela ponte
    const porPonte = identificadores.filter((i) => i.codigo_legacy && i.codigo_legacy === cod);
    const dPonte = new Set(porPonte.map((i) => i.produto_id));
    if (dPonte.size === 1) {
      return { status: "vinculado", tipo: "exato_codigo", produtoId: porPonte[0].produto_id, criariaDescontinuado: false };
    }
    if (dPonte.size > 1) {
      return { status: "duvidoso", tipo: "aproximado", produtoId: null, criariaDescontinuado: false };
    }
  }

  // 3. Descrição normalizada
  if (descNorm) {
    const porDescProd = produtos.filter((p) => normalizarDescricao(p.nome) === descNorm);
    const porDescIdent = identificadores.filter((i) => i.descricao_normalizada === descNorm);
    const distintos = new Set([...porDescProd.map((p) => p.id), ...porDescIdent.map((i) => i.produto_id)]);
    if (distintos.size === 1) {
      const produtoId = porDescProd[0]?.id ?? porDescIdent[0]?.produto_id;
      return { status: "vinculado", tipo: "exato_descricao", produtoId, criariaDescontinuado: false };
    }
    if (distintos.size > 1) {
      return { status: "duvidoso", tipo: "aproximado", produtoId: null, criariaDescontinuado: false };
    }
  }

  // 4. Sem match — se há código, vai virar descontinuado
  return {
    status: "nao_vinculado",
    tipo: "nao_vinculado",
    produtoId: null,
    criariaDescontinuado: Boolean(cod),
  };
}

export function contarPreviewMatches(
  itens: Array<{ codigo: string | null | undefined; descricao: string | null | undefined }>,
  produtos: ProdutoLookup[],
  identificadores: IdentificadorLegacyLookup[],
): PreviewMatchCounts {
  const counts: PreviewMatchCounts = {
    vinculado: 0,
    duvidoso: 0,
    nao_vinculado: 0,
    criar_descontinuado: 0,
  };
  for (const item of itens) {
    const r = classificarMatchPreview(item.codigo, item.descricao, produtos, identificadores);
    if (r.status === "vinculado") counts.vinculado++;
    else if (r.status === "duvidoso") counts.duvidoso++;
    else {
      counts.nao_vinculado++;
      if (r.criariaDescontinuado) counts.criar_descontinuado++;
    }
  }
  return counts;
}
