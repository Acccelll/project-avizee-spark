import { describe, it, expect } from "vitest";
import {
  normalizarDescricao,
  classificarMatchPreview,
  contarPreviewMatches,
  type ProdutoLookup,
  type IdentificadorLegacyLookup,
} from "../produtoMatch";

describe("normalizarDescricao", () => {
  it("lowercase + remove acentos + colapsa whitespace", () => {
    expect(normalizarDescricao("  Café   COM   leite  ")).toBe("cafe com leite");
  });
  it("retorna vazio para null/undefined/empty", () => {
    expect(normalizarDescricao(null)).toBe("");
    expect(normalizarDescricao(undefined)).toBe("");
    expect(normalizarDescricao("")).toBe("");
  });
});

const produtos: ProdutoLookup[] = [
  { id: "p1", codigo_interno: "INT-1", codigo_legado: "LEG-1", nome: "Café Premium 500g", ativo: true },
  { id: "p2", codigo_interno: "INT-2", codigo_legado: "LEG-2", nome: "Açúcar Refinado 1kg", ativo: true },
  { id: "p3", codigo_interno: "INT-3", codigo_legado: null, nome: "Café Premium 500g", ativo: true }, // duplicado por nome
];

const identificadores: IdentificadorLegacyLookup[] = [
  { produto_id: "p1", codigo_legacy: "ALT-1", descricao_normalizada: null },
];

describe("classificarMatchPreview", () => {
  it("vincula por código exato (codigo_legado)", () => {
    const r = classificarMatchPreview("LEG-1", null, produtos, identificadores);
    expect(r).toEqual({ status: "vinculado", tipo: "exato_codigo", produtoId: "p1", criariaDescontinuado: false });
  });

  it("vincula por código exato (codigo_interno)", () => {
    const r = classificarMatchPreview("INT-2", null, produtos, identificadores);
    expect(r.status).toBe("vinculado");
    expect(r.produtoId).toBe("p2");
  });

  it("vincula via tabela ponte de identificadores", () => {
    const r = classificarMatchPreview("ALT-1", null, produtos, identificadores);
    expect(r.status).toBe("vinculado");
    expect(r.produtoId).toBe("p1");
  });

  it("duvidoso quando descrição bate em múltiplos produtos", () => {
    const r = classificarMatchPreview(null, "Cafe Premium 500g", produtos, identificadores);
    expect(r.status).toBe("duvidoso");
    expect(r.produtoId).toBe(null);
  });

  it("nao_vinculado + criariaDescontinuado quando há código sem match", () => {
    const r = classificarMatchPreview("CODIGO-INEXISTENTE", "Produto fantasma", produtos, identificadores);
    expect(r.status).toBe("nao_vinculado");
    expect(r.criariaDescontinuado).toBe(true);
  });

  it("nao_vinculado sem descontinuado quando não há código", () => {
    const r = classificarMatchPreview(null, "Produto fantasma", produtos, identificadores);
    expect(r.status).toBe("nao_vinculado");
    expect(r.criariaDescontinuado).toBe(false);
  });
});

describe("contarPreviewMatches", () => {
  it("agrega contadores corretamente", () => {
    const itens = [
      { codigo: "LEG-1", descricao: null }, // vinculado
      { codigo: "INT-2", descricao: null }, // vinculado
      { codigo: null, descricao: "Cafe Premium 500g" }, // duvidoso
      { codigo: "X-INEXIST", descricao: "Foo" }, // nao_vinculado + descontinuado
      { codigo: null, descricao: "Bar" }, // nao_vinculado sem descontinuado
    ];
    const counts = contarPreviewMatches(itens, produtos, identificadores);
    expect(counts).toEqual({ vinculado: 2, duvidoso: 1, nao_vinculado: 2, criar_descontinuado: 1 });
  });
});