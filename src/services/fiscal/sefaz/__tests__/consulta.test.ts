import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.service", () => ({
  enviarParaSefaz: vi.fn(),
  enviarParaSefazSemAssinatura: vi.fn(),
}));

import {
  enviarParaSefaz,
  enviarParaSefazSemAssinatura,
} from "../httpClient.service";
import { consultarNFe } from "../consulta.service";

const mockSemAssinatura =
  enviarParaSefazSemAssinatura as unknown as ReturnType<typeof vi.fn>;
const mockComAssinatura =
  enviarParaSefaz as unknown as ReturnType<typeof vi.fn>;

const chave = "35200512345678000190550010000000011000000019";
const url =
  "https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx";

afterEach(() => {
  mockSemAssinatura.mockReset();
  mockComAssinatura.mockReset();
});

describe("consultarNFe", () => {
  it("monta consSitNFe com tpAmb correto e usa o fluxo SEM assinatura", async () => {
    mockSemAssinatura.mockResolvedValue({
      sucesso: true,
      xmlRetorno:
        "<retConsSitNFe><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo>" +
        "<nProt>135999999999999</nProt><dhRecbto>2024-05-01T10:00:00-03:00</dhRecbto>" +
        "<tpAmb>1</tpAmb></retConsSitNFe>",
    });

    const r = await consultarNFe(chave, "1", url);

    // Consulta NÃO pode acionar fluxo de assinatura.
    expect(mockComAssinatura).not.toHaveBeenCalled();
    expect(mockSemAssinatura).toHaveBeenCalledTimes(1);

    const [xml, urlArg, soapAction] = mockSemAssinatura.mock.calls[0];
    expect(urlArg).toBe(url);
    expect(soapAction).toBe(
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF",
    );
    expect(xml).toContain("<consSitNFe");
    expect(xml).toContain("<tpAmb>1</tpAmb>");
    expect(xml).toContain(`<chNFe>${chave}</chNFe>`);
    expect(xml).not.toContain("<infNFe");

    expect(r.sucesso).toBe(true);
    expect(r.status).toBe("100");
    expect(r.protocolo).toBe("135999999999999");
    expect(r.dataAutorizacao).toBe("2024-05-01T10:00:00-03:00");
    expect(r.motivo).toMatch(/Autorizado/);
    expect(r.tpAmb).toBe("1");
  });

  it("respeita ambiente de homologação ao montar o XML", async () => {
    mockSemAssinatura.mockResolvedValue({
      sucesso: true,
      xmlRetorno:
        "<retConsSitNFe><cStat>217</cStat><xMotivo>NF-e nao consta na base</xMotivo>" +
        "<tpAmb>2</tpAmb></retConsSitNFe>",
    });

    const r = await consultarNFe(chave, "2", url);

    expect(mockSemAssinatura.mock.calls[0][0]).toContain("<tpAmb>2</tpAmb>");
    expect(r.sucesso).toBe(true);
    expect(r.status).toBe("217");
    expect(r.motivo).toBe("NF-e nao consta na base");
    expect(r.protocolo).toBeUndefined();
  });

  it("propaga erro de transporte como sucesso=false", async () => {
    mockSemAssinatura.mockResolvedValue({
      sucesso: false,
      erro: "Connection reset by peer",
    });

    const r = await consultarNFe(chave, "1", url);

    expect(r.sucesso).toBe(false);
    expect(r.motivo).toBe("Connection reset by peer");
    expect(mockComAssinatura).not.toHaveBeenCalled();
  });

  it("rejeita chave inválida sem chamar SEFAZ", async () => {
    const r = await consultarNFe("12345", "1", url);
    expect(r.sucesso).toBe(false);
    expect(r.motivo).toMatch(/44/);
    expect(mockSemAssinatura).not.toHaveBeenCalled();
  });

  it("rejeita ambiente inválido sem chamar SEFAZ", async () => {
    // @ts-expect-error — testando entrada inválida em runtime
    const r = await consultarNFe(chave, "3", url);
    expect(r.sucesso).toBe(false);
    expect(r.motivo).toMatch(/Ambiente/i);
    expect(mockSemAssinatura).not.toHaveBeenCalled();
  });

  it("rejeita endpoint vazio sem chamar SEFAZ", async () => {
    const r = await consultarNFe(chave, "1", "");
    expect(r.sucesso).toBe(false);
    expect(r.motivo).toMatch(/Endpoint|UF/i);
    expect(mockSemAssinatura).not.toHaveBeenCalled();
  });
});
