import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.service", () => ({
  enviarParaSefaz: vi.fn(),
}));

import { enviarParaSefaz } from "../httpClient.service";
import { inutilizarNumeracao } from "../inutilizacao.service";

const mockEnviar = enviarParaSefaz as unknown as ReturnType<typeof vi.fn>;

const certificadoVault = { tipo: "A1" as const, conteudo: "", senha: "" };
const certificadoInline = { tipo: "A1" as const, conteudo: "BASE64", senha: "pwd" };
const url = "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx";

const baseParams = {
  cnpj: "12345678000190",
  ano: 24,
  serie: 1,
  numInicial: 100,
  numFinal: 105,
  justificativa: "Quebra de sequência por erro de impressão fiscal",
  uf: "SP",
};

afterEach(() => {
  mockEnviar.mockReset();
});

describe("inutilizarNumeracao", () => {
  it("usa Vault quando certificado vazio e SOAPAction correto", async () => {
    mockEnviar.mockResolvedValue({
      sucesso: true,
      xmlRetorno:
        "<retInut><cStat>102</cStat><xMotivo>Inutilização homologada</xMotivo><nProt>422200000000001</nProt><dhRecbto>2024-02-01T11:00:00-03:00</dhRecbto></retInut>",
    });

    const r = await inutilizarNumeracao(baseParams, certificadoVault, url);

    expect(r).toEqual({
      sucesso: true,
      protocolo: "422200000000001",
      dataRetorno: "2024-02-01T11:00:00-03:00",
      motivo: "Inutilização homologada",
    });
    expect(mockEnviar.mock.calls[0][2]).toBe(
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4/nfeInutilizacaoNF",
    );
    expect(mockEnviar.mock.calls[0][3]).toBeNull();
  });

  it("envia certificado inline quando completo", async () => {
    mockEnviar.mockResolvedValue({
      sucesso: true,
      xmlRetorno: "<retInut><cStat>102</cStat><xMotivo>ok</xMotivo></retInut>",
    });
    await inutilizarNumeracao(baseParams, certificadoInline, url);
    expect(mockEnviar.mock.calls[0][3]).toEqual({
      certificado_base64: "BASE64",
      certificado_senha: "pwd",
    });
  });

  it("retorna sucesso=false para cStat diferente de 102", async () => {
    mockEnviar.mockResolvedValue({
      sucesso: true,
      xmlRetorno: "<retInut><cStat>241</cStat><xMotivo>Já inutilizada</xMotivo></retInut>",
    });
    const r = await inutilizarNumeracao(baseParams, certificadoVault, url);
    expect(r.sucesso).toBe(false);
    expect(r.motivo).toBe("Já inutilizada");
  });

  it("propaga erro de transporte da SEFAZ", async () => {
    mockEnviar.mockResolvedValue({ sucesso: false, erro: "ECONNRESET" });
    const r = await inutilizarNumeracao(baseParams, certificadoVault, url);
    expect(r).toEqual({ sucesso: false, motivo: "ECONNRESET" });
  });
});