import { describe, it, expect, vi, afterEach } from "vitest";
import { parseOFX } from "@/services/financeiro/ofxParser.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Cria um File mock a partir de texto OFX com polyfill de `text()` para jsdom.
 * jsdom não implementa `Blob.prototype.text`, por isso adicionamos manualmente.
 */
function mockFile(content: string, name = "extrato.ofx"): File {
  const file = new File([content], name, { type: "text/plain" });
  // Polyfill: jsdom não suporta Blob.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (file as any).text = async () => content;
  return file;
}

/** Exemplo mínimo de OFX válido no formato SGML (sem closing tags). */
const OFX_SGML_VALIDO = `
OFXHEADER:100
DATA:OFXSGML

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310
<TRNAMT>-1500.00
<FITID>001
<MEMO>PAG FORNECEDOR ABC
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260312
<TRNAMT>2000.50
<FITID>002
<MEMO>REC CLIENTE XYZ
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

/** Exemplo de OFX válido no formato XML (com closing tags). */
const OFX_XML_VALIDO = `
<?xml version="1.0" encoding="UTF-8"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260301120000</DTPOSTED>
<TRNAMT>-750.00</TRNAMT>
<FITID>TXN-001</FITID>
<MEMO>BOLETO 123456</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parseOFX (service)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("faz parse de arquivo OFX SGML válido com 2 transações", async () => {
    const file = mockFile(OFX_SGML_VALIDO);
    const transacoes = await parseOFX(file);
    expect(transacoes).toHaveLength(2);
  });

  it("classifica débitos como tipo 'D' e valor positivo", async () => {
    const file = mockFile(OFX_SGML_VALIDO);
    const [debito] = await parseOFX(file);
    expect(debito.tipo).toBe("D");
    expect(debito.valor).toBe(1500);
  });

  it("classifica créditos como tipo 'C' e valor positivo", async () => {
    const file = mockFile(OFX_SGML_VALIDO);
    const [, credito] = await parseOFX(file);
    expect(credito.tipo).toBe("C");
    expect(credito.valor).toBe(2000.5);
  });

  it("converte data OFX para formato ISO YYYY-MM-DD", async () => {
    const file = mockFile(OFX_SGML_VALIDO);
    const transacoes = await parseOFX(file);
    expect(transacoes[0].data).toBe("2026-03-10");
    expect(transacoes[1].data).toBe("2026-03-12");
  });

  it("preenche a descrição com o campo MEMO", async () => {
    const file = mockFile(OFX_SGML_VALIDO);
    const transacoes = await parseOFX(file);
    expect(transacoes[0].descricao).toBe("PAG FORNECEDOR ABC");
    expect(transacoes[1].descricao).toBe("REC CLIENTE XYZ");
  });

  it("preserva o FITID como id da transação", async () => {
    const file = mockFile(OFX_SGML_VALIDO);
    const transacoes = await parseOFX(file);
    expect(transacoes[0].id).toBe("001");
    expect(transacoes[1].id).toBe("002");
  });

  it("faz parse de arquivo OFX XML válido", async () => {
    const file = mockFile(OFX_XML_VALIDO);
    const transacoes = await parseOFX(file);
    expect(transacoes).toHaveLength(1);
    expect(transacoes[0].valor).toBe(750);
    expect(transacoes[0].tipo).toBe("D");
    expect(transacoes[0].data).toBe("2026-03-01");
  });

  it("converte data com timestamp (YYYYMMDDHHMMSS) corretamente", async () => {
    const file = mockFile(OFX_XML_VALIDO);
    const [txn] = await parseOFX(file);
    expect(txn.data).toBe("2026-03-01");
  });

  it("lança erro para arquivo sem transações", async () => {
    const semTransacoes = "<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>";
    const file = mockFile(semTransacoes);
    await expect(parseOFX(file)).rejects.toThrow(
      "Nenhuma transação encontrada no arquivo OFX.",
    );
  });

  it("lança erro para arquivo completamente inválido", async () => {
    const file = mockFile("isso nao e um ofx valido");
    await expect(parseOFX(file)).rejects.toThrow();
  });

  it("lança erro para arquivo vazio", async () => {
    const file = mockFile("");
    await expect(parseOFX(file)).rejects.toThrow();
  });
});
