import { describe, it, expect } from "vitest";
import {
  extrairChaveDeTextoOuUrl,
  tipoDocumentoPelaChave,
  lerChaveDeEntrada,
} from "../chaveAcesso.parser";

/**
 * Geramos chaves dinamicamente (com DV correto) para evitar acoplar testes a
 * chaves reais. cUF=35 (SP), AAMM=2604, CNPJ fictício, modelo, série, número,
 * tpEmis=1, cNF=12345678 → calcula DV.
 */
function montar(modelo: "55" | "65", numero = "000000001"): string {
  const corpo43 = `35` + `2604` + `12345678000190` + modelo + `001` + numero + `1` + `12345678`;
  // DV MOD11
  const digits = corpo43.split("").map(Number);
  let peso = 2;
  let soma = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    soma += digits[i] * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return corpo43 + String(dv);
}

const CHAVE_NFE = montar("55");
const CHAVE_NFCE = montar("65", "000000099");

describe("extrairChaveDeTextoOuUrl", () => {
  it("aceita chave pura", () => {
    expect(extrairChaveDeTextoOuUrl(CHAVE_NFE)).toBe(CHAVE_NFE);
  });

  it("aceita chave com espaços e pontos", () => {
    const formatada = CHAVE_NFE.match(/.{1,4}/g)!.join(" . ");
    expect(extrairChaveDeTextoOuUrl(formatada)).toBe(CHAVE_NFE);
  });

  it("extrai de URL de QR Code NFC-e SP (parâmetro p com pipes)", () => {
    const url = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE_NFCE}|2|1|1|abcd`;
    expect(extrairChaveDeTextoOuUrl(url)).toBe(CHAVE_NFCE);
  });

  it("extrai de URL de portal NF-e com chNFe", () => {
    const url = `https://www.nfe.fazenda.gov.br/portal/consultaResumo.aspx?chNFe=${CHAVE_NFE}&tipoConteudo=x`;
    expect(extrairChaveDeTextoOuUrl(url)).toBe(CHAVE_NFE);
  });

  it("extrai de texto livre com a chave embutida", () => {
    const texto = `NF emitida — chave: ${CHAVE_NFE} — protocolo 123`;
    expect(extrairChaveDeTextoOuUrl(texto)).toBe(CHAVE_NFE);
  });

  it("rejeita chave com DV inválido", () => {
    const corpo43 = CHAVE_NFE.slice(0, 43);
    const dvErrado = (Number(CHAVE_NFE[43]) + 1) % 10;
    expect(extrairChaveDeTextoOuUrl(corpo43 + dvErrado)).toBeNull();
  });

  it("rejeita input vazio/nulo", () => {
    expect(extrairChaveDeTextoOuUrl("")).toBeNull();
    expect(extrairChaveDeTextoOuUrl(null)).toBeNull();
    expect(extrairChaveDeTextoOuUrl("   ")).toBeNull();
  });

  it("escolhe a sequência válida quando há várias candidatas", () => {
    const seqInvalida = "1".repeat(44);
    const texto = `${seqInvalida} foo ${CHAVE_NFE} bar`;
    expect(extrairChaveDeTextoOuUrl(texto)).toBe(CHAVE_NFE);
  });
});

describe("tipoDocumentoPelaChave", () => {
  it("identifica NF-e (modelo 55)", () => {
    expect(tipoDocumentoPelaChave(CHAVE_NFE)).toBe("NF-e");
  });
  it("identifica NFC-e (modelo 65)", () => {
    expect(tipoDocumentoPelaChave(CHAVE_NFCE)).toBe("NFC-e");
  });
  it("retorna 'outro' para tamanho inválido", () => {
    expect(tipoDocumentoPelaChave("123")).toBe("outro");
  });
});

describe("lerChaveDeEntrada", () => {
  it("decompõe a chave válida em info estruturada", () => {
    const r = lerChaveDeEntrada(CHAVE_NFE)!;
    expect(r).not.toBeNull();
    expect(r.chave).toBe(CHAVE_NFE);
    expect(r.tipo).toBe("NF-e");
    expect(r.info.uf).toBe("SP");
    expect(r.info.cnpj).toBe("12345678000190");
    expect(r.info.modelo).toBe("55");
  });
  it("retorna null para entrada inválida", () => {
    expect(lerChaveDeEntrada("xxx")).toBeNull();
  });
});