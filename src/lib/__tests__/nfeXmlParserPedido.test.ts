import { describe, it, expect } from "vitest";
import { parseNFeXml } from "../nfeXmlParser";
import { extrairReferenciasPedido } from "../referenciasPedido";

function det(n: number, xPed?: string, nItemPed?: string) {
  return `<det nItem="${n}"><prod><cProd>P${n}</cProd><xProd>ITEM ${n}</xProd><NCM>84369100</NCM><CFOP>6102</CFOP>
    <uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>10.00</vUnCom><vProd>10.00</vProd>
    ${xPed ? `<xPed>${xPed}</xPed>` : ""}${nItemPed ? `<nItemPed>${nItemPed}</nItemPed>` : ""}</prod>
    <imposto><ICMS><ICMSSN102><orig>0</orig></ICMSSN102></ICMS></imposto></det>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35260553078538000185551000000003371300002411">
  <ide><nNF>337</nNF><serie>100</serie><dhEmi>2026-05-15T10:00:00-03:00</dhEmi><tpNF>1</tpNF><mod>55</mod><natOp>Venda</natOp></ide>
  <emit><CNPJ>53078538000185</CNPJ><xNome>EMITENTE</xNome></emit>
  <dest><CNPJ>00466591000149</CNPJ><xNome>CLIENTE</xNome></dest>
  ${det(1, "4500112735", "300148")}${det(2, "4500112736", "300144")}${det(3)}
  <total><ICMSTot><vProd>30.00</vProd><vNF>30.00</vNF></ICMSTot></total>
  <infAdic><infCpl>PEDIDO 4500112735, 4500112897; 4500112736. VENCT. 18/06/2026</infCpl></infAdic>
</infNFe></NFe></nfeProc>`;

describe("parseNFeXml — pedido do cliente", () => {
  it("lê xPed/nItemPed dos itens e as informações complementares", () => {
    const nfe = parseNFeXml(xml);
    expect(nfe.itens.map((i) => [i.pedido, i.itemPedido])).toEqual([
      ["4500112735", "300148"],
      ["4500112736", "300144"],
      [undefined, undefined],
    ]);
    expect(nfe.informacoesComplementares).toContain("PEDIDO 4500112735");
    expect(extrairReferenciasPedido(nfe)).toEqual(["4500112735", "4500112736", "4500112897"]);
  });
});
