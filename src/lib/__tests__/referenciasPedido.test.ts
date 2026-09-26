import { describe, it, expect } from "vitest";
import { extrairReferenciasDoTexto, extrairReferenciasPedido } from "../referenciasPedido";

// Trechos reais das informações complementares das NFs do Sebrae.
const SIMPLES = "DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.";

describe("extrairReferenciasDoTexto", () => {
  it.each([
    [`PEDIDO: 4500114274; VENCT. 08/06/2026 ${SIMPLES}`, ["4500114274"]],
    [`PEDIDOS: 4500112984, 4500113048 VENCT. 03/06/2026 ${SIMPLES}`, ["4500112984", "4500113048"]],
    [`PEDIDO 4500112735, 4500112897; 4500112736. VENCT. 18/06/2026`, ["4500112735", "4500112897", "4500112736"]],
    [`PEDIDO: 1.181; VENCT. 20/07/2026`, ["1.181"]],
    [`PEDIDO: 936634; POR MATHEUS MEIRELES; VENCT. 11/06/2026`, ["936634"]],
    [`OC: 3731 ; LANTERNAS INCUBATORIO; VENCT. 28/10/2025`, ["3731"]],
    [`PC: 045900 VENCT. 14/08/2025`, ["045900"]],
    [`VENCT.15/07/2024  PEDIDO DE COMPRA 158199 ${SIMPLES}`, ["158199"]],
    [`N PEDIDO 4500018919 CONTATO: GISELE FERRO  CODIGO 5001198`, ["4500018919"]],
    [`PEDIDO 4506363916 ITEM 00010 LAMINA BC VENC. 16/04/2024`, ["4506363916"]],
    [`ORC100291; VENCT. 27/07/2026 ${SIMPLES}`, ["ORC100291"]],
    [`ORC. 100160; PAGT. A VISTA`, ["ORC100160"]],
  ])("%s", (texto, esperado) => {
    expect(extrairReferenciasDoTexto(texto)).toEqual(esperado);
  });

  it("ignora textos sem número de pedido", () => {
    expect(extrairReferenciasDoTexto(`ORC VIA WPP; VENCT. A VISTA ${SIMPLES}`)).toEqual([]);
    expect(extrairReferenciasDoTexto(`VENCT. 05/11/2024 ${SIMPLES}`)).toEqual([]);
    expect(extrairReferenciasDoTexto("Remessa em bonificacao, doacao ou brinde")).toEqual([]);
    expect(extrairReferenciasDoTexto(null)).toEqual([]);
  });
});

describe("extrairReferenciasPedido", () => {
  it("junta xPed dos itens e o texto, sem repetir", () => {
    const refs = extrairReferenciasPedido({
      itens: [
        { pedido: "4500112735" },
        { pedido: "4500112736" },
        { pedido: "4500112735" },
        {},
      ] as never,
      informacoesComplementares: "PEDIDO: 4500112736; 4500112897. VENCT. 30/06/2026",
    });
    expect(refs).toEqual(["4500112735", "4500112736", "4500112897"]);
  });
});
