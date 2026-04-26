import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.service", () => ({
  enviarParaSefaz: vi.fn(),
}));

import { enviarParaSefaz } from "../httpClient.service";
import { cancelarNFe } from "../cancelamento.service";

const mockEnviar = enviarParaSefaz as unknown as ReturnType<typeof vi.fn>;

const certificadoVault = { conteudo: "", senha: "" };
const certificadoInline = { conteudo: "BASE64==", senha: "secret" };
const emitente = { cnpj: "12345678000190" };
const url = "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx";
const chave = "35200512345678000190550010000000011000000019";
const protocolo = "135200000000001";
const justificativa = "Erro na emissão da nota — necessário cancelar";

afterEach(() => {
  mockEnviar.mockReset();
});

describe("cancelarNFe", () => {
  it("usa Vault (certificado=null) quando conteúdo/senha vazios", async () => {
    mockEnviar.mockResolvedValue({
      sucesso: true,
      xmlRetorno:
        "<retEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><nProt>135999999999999</nProt><dhRegEvento>2024-01-01T10:00:00-03:00</dhRegEvento></retEvento>",
    });

    const r = await cancelarNFe(chave, protocolo, justificativa, certificadoVault, url, emitente, "2");

    expect(r.sucesso).toBe(true);
    expect(r.protocolo).toBe("135999999999999");
    expect(r.dataRetorno).toBe("2024-01-01T10:00:00-03:00");
    expect(r.motivo).toMatch(/registrado/);

    const args = mockEnviar.mock.calls[0];
    expect(args[1]).toBe(url);
    expect(args[2]).toBe(
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",
    );
    expect(args[3]).toBeNull(); // vault
  });

  it("envia certificado inline quando conteúdo+senha presentes", async () => {
    mockEnviar.mockResolvedValue({
      sucesso: true,
      xmlRetorno: "<retEvento><cStat>155</cStat><xMotivo>Cancelamento extemporâneo</xMotivo></retEvento>",
    });

    const r = await cancelarNFe(chave, protocolo, justificativa, certificadoInline, url, emitente);

    expect(r.sucesso).toBe(true); // 155 também é sucesso
    expect(mockEnviar.mock.calls[0][3]).toEqual({
      certificado_base64: "BASE64==",
      certificado_senha: "secret",
    });
  });

  it("retorna sucesso=false quando cStat não é 135 nem 155", async () => {
    mockEnviar.mockResolvedValue({
      sucesso: true,
      xmlRetorno: "<retEvento><cStat>573</cStat><xMotivo>Duplicidade de evento</xMotivo></retEvento>",
    });
    const r = await cancelarNFe(chave, protocolo, justificativa, certificadoVault, url, emitente);
    expect(r.sucesso).toBe(false);
    expect(r.motivo).toBe("Duplicidade de evento");
  });

  it("propaga erro de rede da SEFAZ", async () => {
    mockEnviar.mockResolvedValue({ sucesso: false, erro: "Timeout SEFAZ" });
    const r = await cancelarNFe(chave, protocolo, justificativa, certificadoVault, url, emitente);
    expect(r).toEqual({ sucesso: false, motivo: "Timeout SEFAZ" });
  });
});