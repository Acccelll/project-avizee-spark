import { describe, it, expect } from "vitest";
import { extrairMemo } from "../memoExtractors";
import { canonizarTrntype } from "../trntype";

describe("canonizarTrntype", () => {
  it("mapeia códigos padrão OFX", () => {
    expect(canonizarTrntype("DEBIT")).toBe("debito");
    expect(canonizarTrntype("XFER")).toBe("transferencia");
    expect(canonizarTrntype("FEE")).toBe("tarifa");
    expect(canonizarTrntype("desconhecido")).toBe("outros");
    expect(canonizarTrntype(undefined)).toBe("outros");
  });
});

describe("extrairMemo", () => {
  it("reconhece PIX do Banco Inter com CPF", () => {
    const r = extrairMemo("Pix enviado — JOAO DA SILVA — CPF 123.456.789-00");
    expect(r.origem_padrao).toBe("banco_inter");
    expect(r.forma_pagamento).toBe("pix");
    expect(r.favorecido).toBe("JOAO DA SILVA");
    expect(r.favorecido_documento).toBe("12345678900");
  });

  it("reconhece Mercado Pago", () => {
    const r = extrairMemo("MERCADOPAGO*LOJAX 12.345.678/0001-99");
    expect(r.origem_padrao).toBe("mercado_pago");
    expect(r.categoria_sugerida).toBe("marketplace");
    expect(r.favorecido_documento).toBe("12.345.678/0001-99");
  });

  it("reconhece RecargaPay", () => {
    const r = extrairMemo("RECARGAPAY*NETFLIX");
    expect(r.origem_padrao).toBe("recargapay");
    expect(r.forma_pagamento).toBe("cartao");
  });

  it("reconhece boleto por palavra-chave", () => {
    const r = extrairMemo("Pagamento de boleto — ENERGISA");
    expect(r.origem_padrao).toBe("boleto");
    expect(r.forma_pagamento).toBe("boleto");
  });

  it("retorna objeto vazio para memo desconhecido", () => {
    expect(extrairMemo("XYZ")).toEqual({});
    expect(extrairMemo(null)).toEqual({});
  });
});