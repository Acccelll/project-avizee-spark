import { describe, expect, it } from "vitest";
import { resolverUrlSefaz, UFS_SUPORTADAS } from "../sefazUrls.service";

describe("resolverUrlSefaz", () => {
  it("retorna endpoint de produção para SP/autorizacao", () => {
    expect(resolverUrlSefaz("SP", "1", "autorizacao")).toBe(
      "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
    );
  });

  it("retorna endpoint de homologação para SP/consulta", () => {
    expect(resolverUrlSefaz("SP", "2", "consulta")).toBe(
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
    );
  });

  it("normaliza UF (lowercase + espaços)", () => {
    expect(resolverUrlSefaz("  sp  ", "2", "evento")).toBe(
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",
    );
  });

  it("cobre todos os 5 serviços para ambiente homologação", () => {
    const servicos = ["autorizacao", "consulta", "evento", "inutilizacao", "status"] as const;
    for (const s of servicos) {
      expect(resolverUrlSefaz("SP", "2", s)).toMatch(/^https:\/\/homologacao\.nfe\.fazenda\.sp\.gov\.br\//);
    }
  });

  it("falha cedo com mensagem útil para UF não mapeada", () => {
    expect(() => resolverUrlSefaz("RJ", "2", "autorizacao")).toThrow(/RJ/);
    expect(() => resolverUrlSefaz("RJ", "2", "autorizacao")).toThrow(/apenas SP/i);
  });

  it("UFS_SUPORTADAS contém SP", () => {
    expect(UFS_SUPORTADAS).toContain("SP");
  });
});