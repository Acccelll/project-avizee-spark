import { describe, it, expect } from "vitest";
import {
  validarEtiquetas,
  type EtiquetaSimplesItem,
  type EnderecoEtiqueta,
} from "../etiquetasSimples.service";

function endereco(over: Partial<EnderecoEtiqueta> = {}): EnderecoEtiqueta {
  return {
    nome: "Acme Ltda",
    logradouro: "Rua A",
    numero: "100",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01001000",
    ...over,
  };
}

function item(over: Partial<EtiquetaSimplesItem> = {}): EtiquetaSimplesItem {
  return {
    remessaId: "rem-1",
    remessaRef: "REM1",
    remetente: endereco(),
    destinatario: endereco({ nome: "Cliente XPTO" }),
    ...over,
  };
}

describe("validarEtiquetas", () => {
  it("aceita endereços completos", () => {
    const r = validarEtiquetas([item()]);
    expect(r.validas).toHaveLength(1);
    expect(r.invalidas).toHaveLength(0);
  });

  it("rejeita quando faltam campos obrigatórios", () => {
    const r = validarEtiquetas([
      item({ destinatario: endereco({ nome: "", cidade: "" }) }),
    ]);
    expect(r.validas).toHaveLength(0);
    expect(r.invalidas[0].faltando).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Destinatário: nome"),
        expect.stringContaining("Destinatário: cidade"),
      ]),
    );
  });

  it("rejeita CEP com tamanho diferente de 8 dígitos", () => {
    const r = validarEtiquetas([
      item({ remetente: endereco({ cep: "123" }) }),
    ]);
    expect(r.invalidas[0].faltando).toContain("Remetente: CEP inválido");
  });

  it("rejeita UF com tamanho diferente de 2", () => {
    const r = validarEtiquetas([
      item({ destinatario: endereco({ uf: "SAO" }) }),
    ]);
    expect(r.invalidas[0].faltando).toContain("Destinatário: UF inválida");
  });

  it("separa itens válidos e inválidos no mesmo lote", () => {
    const r = validarEtiquetas([
      item({ remessaId: "ok" }),
      item({ remessaId: "bad", destinatario: endereco({ cep: "" }) }),
    ]);
    expect(r.validas.map((v) => v.remessaId)).toEqual(["ok"]);
    expect(r.invalidas.map((v) => v.remessaId)).toEqual(["bad"]);
  });
});