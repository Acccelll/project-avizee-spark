import { describe, it, expect } from "vitest";
import { parseNFeXml } from "@/lib/nfeXmlParser";

// Mock XML string based on standard SEFAZ structure
const MOCK_XML = `
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35240312345678901234550010000001231000001234" versao="4.00">
      <ide>
        <nNF>123</nNF>
        <serie>1</serie>
        <dhEmi>2024-03-25T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>FORNECEDOR TESTE LTDA</xNome>
        <xFant>TESTE FORN</xFant>
        <IE>123456789</IE>
        <enderEmit>
          <UF>SP</UF>
        </enderEmit>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>PROD001</cProd>
          <xProd>PRODUTO DE TESTE XML</xProd>
          <NCM>12345678</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>50.0000000000</vUnCom>
          <vProd>500.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <vICMS>90.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vProd>500.00</vProd>
          <vFrete>0.00</vFrete>
          <vDesc>0.00</vDesc>
          <vOutro>0.00</vOutro>
          <vICMS>90.00</vICMS>
          <vIPI>0.00</vIPI>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vST>0.00</vST>
          <vNF>500.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>
`;

describe("NFe XML Parser", () => {
  it("should correctly parse a valid NFe XML", () => {
    const data = parseNFeXml(MOCK_XML);

    expect(data.numero).toBe("123");
    expect(data.serie).toBe("1");
    expect(data.chaveAcesso).toBe("35240312345678901234550010000001231000001234");
    expect(data.dataEmissao).toBe("2024-03-25");
    expect(data.emitente.cnpj).toBe("12345678000199");
    expect(data.emitente.razaoSocial).toBe("FORNECEDOR TESTE LTDA");
    expect(data.valorTotal).toBe(500);
    expect(data.itens).toHaveLength(1);
    expect(data.itens[0].codigo).toBe("PROD001");
    expect(data.itens[0].quantidade).toBe(10);
    expect(data.itens[0].icms).toBe(90);
  });

  it("should throw error for invalid XML", () => {
    expect(() => parseNFeXml("<invalid>xml</invalid>")).toThrow();
  });
});
